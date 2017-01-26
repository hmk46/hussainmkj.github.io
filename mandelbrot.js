// check for z being analytically known to be in the Mandelbrot set
function analytically_in_mb(zr, zi, qr, qi, mod) {
	if(zr == 0 && zi == 0) {
		return true;
	}
	// cardioid test
	var q = mod-zr/2+1/16;
	if(q*(q+zr-1/4)-qi/4 < 0) {;
		return 1;
	}
	// period 2 bulb
	if(mod+zr+15/16 < 0) {
		return 1;
	}
	return 0;
}

// iterate a single point z up to maxiter times,
// returning 0 if z does not diverge,
// or a fractional normalized escape count
function iterate_point(cr, ci, squared_escape, maxiter, log) {
	// iteration value
	var zr = cr;
	var zi = ci;
	// squares of iteration value
	var qr = cr*cr;
	var qi = ci*ci;
	// modulus of iteration value
	var mod = qr+qi;
	if(analytically_in_mb(zr, zi, qr, qi, mod)) {
		return 0;
	}
	var iter = 2; // the first iteration gives cr+i*ci as assigned already
	while(1) {
		if(iter > maxiter) {
			break;
		}
		zr = qr-qi+cr;
		zi = zi*zr;
		zi = zi+zi+ci;
		qr = zr*zr;
		qi = zi*zi;
		mod = qr+qi;
		if(analytically_in_mb(zr, zi, qr, qi, mod)) {
			return 0;
		}
		if(mod > squared_escape) { // z diverges
			return (iter+2-log(log(mod))/log(2))/maxiter;
		}
		iter += 1;
	}
	return 0;
}

// maps 0<hue<=1 to HSV space of 0<h<360, s=1, v=1 linearly
// (as a 2pi*hue rotation around the cylinder boundary)
function colorize(buff, ptr, hue, min, interval) {
	ptr *= 4; // change ptr from 8 to single byte representation, then divide by 2 because the pixel values are only in the first half of buff
	buff[ptr+3] = 255; // full alpha value for everything
	if(hue == 0) {
		buff[ptr] = 0;
		buff[ptr+1] = 0;
		buff[ptr+2] = 0;
		return;
	}
	hue -= min;
	hue /= interval;
	hue *= 767; // 3*256-1
	hue = hue|0;
	if(hue < 256) { // red-blue sector
		buff[ptr] = 255-hue;
		buff[ptr+1] = hue;
		buff[ptr+2] = 0;
	} else if(hue < 512) { // blue-green sector
		buff[ptr] = 0;
		buff[ptr+1] = 511-hue;
		buff[ptr+2] = hue-256;
	} else { // green-red sector
		buff[ptr] = hue-512;
		buff[ptr+1] = 0;
		buff[ptr+2] = 767-hue;
	}
	return;
}

// buff is a byte buffer that is 8 the sice of the number of pixels:
// each pixel needs 8 bytes for the double precision hue value.
// The computed pixel values will be written to the first half of the buffer,
// since only 4 bytes (RGBA) are needed for each.
// xres, yres are the pixel dimensions of the view.
// Scale>=1 is a zoom value that just divides the effective radius.
// orgr, orgi are the complex coordinates of the center of the view.
// Squared_escape is the square of the escape radius.
// Maxiter is the maximum iteration count.
// Rot is an angle that is optionally used to take rotated coordinates.
function draw_mandelbrot_image(buff, xres, yres, scale, orgr, orgi, squared_escape, maxiter, rot) {
	var r = 0;
	if(scale < 1) {
		return;
	}
	var offset = (orgr*orgr) + (orgi*orgi);
	if(offset > 4) {
		return;
	}
	// set the radius
	if(offset == 0) {
		r = 2;
	} else {
		r = 2-Math.sqrt(offset);
	}
	r = r/scale;
	var xstep = 2*r/xres;
	var ystep = 2*r/yres;
	// only continue if the resolution isn't too fine for floating point precision
	if(xstep == 0 || ystep == 0) {
		return;
	}
	// Iteration setup:
	var view_64 = new Float64Array(buff);
	var dptr = 0; // pointer to 64-bit buffer view
	// values used for rotations:
	var actual_cr = 0, actual_ci = 0;
	var rotr = 0, roti = 0;
	// precalculate the first x-coordinate value so it isn't recalculated for each row
	var begin_cr = orgr-r;
	// hue value tracking
	var hue = 0;
	var min_hue = 1;
	var max_hue = 0;
	var hue_interval = 0;
	// loop variables: vy, vx for pixel positions; ci, cr for complex coordinates
	var vy, vx, ci, cr;
	// precache Math.log so it's reference isn't searched for every iteration
	var log = Math.log;
	// First pass: store hue values in buff and track min and max hue values.
	for(vy = yres, ci = orgi+r; vy--; ci -= ystep) {
		for(vx = xres, cr = begin_cr; vx--; cr += xstep) {
		actual_cr = cr;
		actual_ci = ci;
		if(rot > 0) { // rotate coordinate values rot radians with a complex multiplication by e^(i*rot)
			rotr = Math.cos(rot);
			roti = Math.sin(rot);
			actual_cr = (cr*rotr)-(ci*roti);
			actual_ci = (cr*roti) + (ci*rotr);
		}
		hue = iterate_point(actual_cr, actual_ci, squared_escape, maxiter, log);
		view_64[dptr] = hue;
		dptr += 1;
		if(hue < min_hue) {
			min_hue = hue;
		}
		if(hue > max_hue) {
			max_hue = hue;
		}
	}
	}
	// Hue values are normalized so that they span the entire (0,1] interval.
	// The normalization is linear.
	// This is important for very zoomed images, where the raw hue distribution has a varience that is too small to give different colors.
	hue_interval = max_hue - min_hue;
	var dptr_max = xres*yres;
	var view_u8 = new Uint8Array(buff); // view for RGBA pixel components
	// Second pass: write normalized color values to the buffer.
	for(dptr = 0; dptr < dptr_max; dptr++) {
		colorize(view_u8, dptr, view_64[dptr], min_hue, hue_interval);
	}
	return;
}
