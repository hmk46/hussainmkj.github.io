// ====== helper functions for handling complex quantities ======

// generating function for the mandelbrot set := z^2+c
// z^2 = (x+iy)^2 = (x^2-y^2)+2ixy = (x-y)(x+y)+2ixy
function mbgen_r(zr, zi, cr) {
	return ((zr-zi)*(zr+zi))+cr;
}
function mbgen_i(zr, zi, ci) {
	return (2*zr*zi)+ci;
}

// complex product z*w
// z*w = (x+iy)*(u+iv) = (xu-yv)+i(xv+yu)
function cprod_r(zr, zi, wr, wi) {
	return (zr*wr)-(xi*wi);
}

function cprod_i(zr, zi, wr, wi) {
	return (zr*wi)+(zi*wr);
}

// squared modulus of z = x+iy := z*z| = x^2+y^2
function cmodsq(zr, zi) {
	return (zr*zr)+(zi*zi);
}

function analytically_in_mb(zr, zi) {
	return false;
}


// ====== mandelbrot set ======

/* @mb_gen_data(params):
 * @ scale: a positive number that is used to determine how zoomed in the mandelbrot set is
 * @xres: width of view in pixels
 * @yres: height of view in pixels
 * @orgr: real part of the origine (where the mandelbrot set is centred)
 * @orgi: imaginary part of the origine
 * @maxiter: maximum number of iterations to test
 *
 * returns a data object with histogram, and view fields:
 * histogram is an array of length maxiter that tracks the number of values that escaped for each iteration
 * view is a 2d array of dimensions yres * xres with 0, 0 at the top left that tracks the number of iterations it takes each pixel to escape (0 for non-escaping)
*/
function mb_gen_data(scale, xres, yres, orgr, orgi, maxiter, rot) {
	if(scale < 1) {
		return 0;
	}
	offset = 1.0 * cmodsq(orgr, orgi);
	if(offset >= 4.0) {
		return 0;
	}
	// set the radius
	if(offset == 0.0) {
		r = 2.0;
	} else {
		r = 2-Math.sqrt(offset);
	}
	r /= (scale);
	xstep = 2*r/xres;
	ystep = 2*r/yres;
	// only continue if the resolution isn't too fine for floating point precision
	if(xstep == 0.0 || ystep == 0.0) {
		return 0;
	}
//	hist = new Array(maxiter);
	view = new Array(yres);
	// initialize hist to all 0
//	for(i = 0; i < maxiter; i++) {
//		hist[i] = 0;
//	}
	// do the mandelbrot iteration for each pixel in view
	// vy, vx are pixels in view, pi, pr are points on complex plane being considered
	for(vy = 0, ci = orgi+r; vy < yres; vy++, ci -= ystep) {
		// initialize row of view
		view[vy] = new Array(xres);
		for(i = 0; i < xres; i++) {
			view[vy][i] = 0;
		}
		for(vx = 0, cr = orgr-r; vx < xres; vx++, cr += xstep) {
			actual_cr = cr;
			actual_ci = ci;
			if(rot > 0.0) {
				rotr = Math.cos(rot);
				roti = Math.sin(rot);
				actual_cr = (cr*rotr)-(ci*roti);
				actual_ci = (cr*roti)+(ci*rotr);
			}
			// do the mandelbrot iteration for c = pr+i*pi
			// iterated value tracking
			zr = actual_cr;
			zi = actual_ci;
			// squared values
			qr = zr*zr;
			qi = zi*zi;
			// modulus of z
			mod = 0;
			for(iter = 1; iter < maxiter; iter++) {
				zr = qi-qr+actual_cr;
				zi = (2*zr*zi)+actual_ci;
				qr = zr*zr;
				qi = zi*zi;
				if(analytically_in_mb(zr, zi)) {
					break;
				}
				mod = qr+qi;
				if(mod > 4000) {
					view[vy][vx] = 1-(Math.log(Math.log(mod))/(iter*Math.LN2));
//					hist[iter]++;
//					hist[0]++;
					break;
				}
			}
		}
	}
	return {
//		"histogram" : hist,
		"view" : view,
	};
}

function draw_mandelbrot_image(mbdata, ctx) {
	view = mbdata.view;
	//hist = mbdata.histogram;
	length = view.length;
	width = view[0].length;
	image = new Uint8ClampedArray(4*width*length);
/*
	iter_min = 0;
	iter_max = 0;
	for(i = 1; i < hist.length; i++) {
		if(hist[i] > 0) {
			iter_min = i;
			break;
		}
	}
	for(i = hist.length-1; i >= iter_min; i--) {
		if(hist[i] > 0) {
			iter_max = i;
			break;
		}
	}
	iter_accum = hist[0]-hist[iter_min];
	hist[iter_min] = 0.0;
	for(i = iter_min+1; i <= iter_max; i++) {
		hist[i] /= iter_accum;
		hist[i] += hist[i-1];
	}
*/
	// tracking position in image data
	ipos = 0;
	for(y = 0; y < length; y++) {
		for(x = 0; x < width; x++) {
			// mandelbrot view of pixel
			v = view[y][x];
			if(v == 0) {
				color = 0;
				ipos += 3;
			} else {
				hue = 12.0-(12.0*Math.pow(v, 0.95));
				image[ipos++] = Math.round(255*(1-Math.min(hue/3.0, 1.0))); // red
				hue = Math.min(hue-3.0, 0.0);
				image[ipos++] = Math.round(255*(1-Math.min(hue/4.0, 1.0))); // green
				hue = Math.min(hue-4.0, 0.0);
				image[ipos++] = Math.round(255*(1-Math.min(hue/5.0, 1.0))); // blue
			}
			// set alpha to full for everything
			image[ipos++] = 255;
		}
	}
	ctx.putImageData(new ImageData(image, width, length), 0, 0);
}
