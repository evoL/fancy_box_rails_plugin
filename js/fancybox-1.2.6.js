/*
 * FancyBox - Prototype Plugin
 * based on the FancyBox jQuery plugin
 * simple and fancy lightbox alternative
 *
 * Original copyright (c) 2009 Janis Skarnelis
 * Copyright (c) 2010 Rafał Hirsz
 * Examples and documentation at: http://fancybox.net
 * 
 * Version: 1.2.6 (16/11/2009)
 * Requires: Prototype 1.6, Script.aculo.us 1.8
 * 
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

Element.addMethods({
	getOuterHeight: function(element, includeMargins) {
		element = $(element);

		var height = element.getHeight();
		height += parseInt(element.getStyle('padding-top'), 10) + parseInt(element.getStyle('padding-bottom'), 10);
		height += parseInt(element.getStyle('border-top-width'), 10) + parseInt(element.getStyle('border-bottom-width'), 10);
		if (includeMargins === true) {
			height += parseInt(element.getStyle('margin-top'), 10) + parseInt(element.getStyle('margin-bottom'), 10);
		}
		return height;
	},
	getOuterWidth: function(element, includeMargins) {
		element = $(element);
		
		var width = element.getWidth();
		width += parseInt(element.getStyle('padding-left'), 10) + parseInt(element.getStyle('padding-right'), 10);
		width += parseInt(element.getStyle('border-left-width'), 10) + parseInt(element.getStyle('border-right-width'), 10);
		if (includeMargins === true) {
			width += parseInt(element.getStyle('margin-left'), 10) + parseInt(element.getStyle('margin-right'), 10);
		}
		return width;
	},
	
	// because Prototype FAILS
	showBlock: function(element) {
		element = $(element);
		element.style.display = 'block';
		return element;
	},
	visible: function(element) {
		return $(element).getStyle('display') != 'none';
	},
	show: function(element) {
		element = $(element);
		element.setStyle({display: ''});
		return element;
	}
});

var Fancybox = Class.create({
	imageRegExp: /\.(jpg|gif|png|bmp|jpeg)(.*)?$/i,
	IE6: Prototype.Browser.IE && (parseInt(navigator.userAgent.substring(navigator.userAgent.indexOf("MSIE")+5))==6),
	oldIE: this.IE6 || (parseInt(navigator.userAgent.substring(navigator.userAgent.indexOf("MSIE")+5))==7),
	ieQuirks: Prototype.Browser.IE,
	imagePreloader: new Image,
	
	defaults: {
		padding				:	10,
		imageScale			:	true,
		zoomOpacity			:	true,
		zoomSpeedIn			:	0,
		zoomSpeedOut		:	0,
		zoomSpeedChange		:	0.3,
		easingIn			:	Effect.Transitions.sinoidal,
		easingOut			:	Effect.Transitions.sinoidal,
		easingChange		:	Effect.Transitions.sinoidal,
		frameWidth			:	560,
		frameHeight			:	340,
		overlayShow			:	true,
		overlayOpacity		:	0.3,
		overlayColor		:	'#666',
		enableEscapeButton	:	true,
		showCloseButton		:	true,
		hideOnOverlayClick	:	true,
		hideOnContentClick	:	true,
		centerOnScroll		:	true,
		itemArray			:	[],
		onStart	    		:	null,
		onShow				:	null,
		onClose				:	null
	},
	
	initialize: function(el, options) {
		// Convert the input element to $$ format
		if (Object.isString(el)) {
			this.elems = $$(css);
		} else if (Object.isElement(el)) {
			this.elems = [el];
		} else if (Object.isArray(el)) {
			if (el.length > 0) {
				if (Object.isElement(el[0])) {
					this.elems = el;
				} else if (Object.isString(el[0])) {
					var els = [];
					el.each(function(item){
						var sels = $$(item);
						sels.each(function(sel) {
							els.push(sel);
						});
					});
					this.items = els;
				} else this.elems = [];
			} else this.elems = [];
		} else this.elems = [];
		
		var dis = this;
		
		this.busy = false;
		this.options = Object.extend(this.defaults, options);
		this.elems.each(function(x) {
			x.stopObserving('click');
			x.observe('click', function(e) {
				dis.opts = Object.extend({}, dis.options);
				dis._start(Element.extend(x));
				e.stop();
				return false;
			});
		});
	},
	
	_start: function(elem) {
		if (this.busy) return;
		
		if (Object.isFunction(this.opts.onStart))
			this.opts.onStart();
		
		this.opts.itemArray = [];
		this.opts.itemCurrent = 0;
		
		if (this.options.itemArray.length > 0) {
			this.opts.itemArray = this.options.itemArray;
		} else {
			var item = {};
			
			if (!elem.rel || elem.rel == '') {
				var item = {href: elem.href, title: elem.title};
				
				if (elem.down('img')) {
					item.orig = elem.down('img');
				} else {
					item.orig = elem;
				}
				
				if (item.title == '' || typeof item.title == 'undefined') {
					item.title = item.orig.readAttribute('alt');
				}
				
				this.opts.itemArray.push(item);
			} else {	
				var subGroup = this.elems.filter(function(x) {
					return x.match('a[rel=' + elem.rel + ']');
				});
				var item = {};
				
				for (var i = 0; i < subGroup.length; i++) {
					item = {href: subGroup[i].href, title: subGroup[i].title};
					
					if (subGroup[i].down('img')) {
						item.orig = subGroup[i].down('img');
					} else {
						item.orig = subGroup[i];
					}
					
					if (item.title == '' || typeof item.title == 'undefined') {
						item.title = item.orig.readAttribute('alt');
					}

					this.opts.itemArray.push(item);
				}
			}
		}
		
		while (this.opts.itemArray[this.opts.itemCurrent].href != elem.href) {
			this.opts.itemCurrent++;
		}
		
		if (this.opts.overlayShow) {
			if (this.IE6) {
				$$('embed, object, select').each(function(x) { x.setStyle({visibility: hidden}); });
				$('fancy_overlay').setStyle({height: document.viewport.getHeight()});
			}
			
			$('fancy_overlay').setStyle({
				backgroundColor: this.opts.overlayColor,
				opacity: this.opts.overlayOpacity
			}).showBlock();
		}
		
		document.observe('resize', this.scrollBox.bind(this));
		document.observe('scroll', this.scrollBox.bind(this));
		
		this._change_item(elem);
	},
	
	_change_item: function(elem) {
		$$('#fancy_right, #fancy_left, #fancy_close, #fancy_title').each(function(x){ x.hide(); });
		
		var href = this.opts.itemArray[this.opts.itemCurrent].href;
		
		if (href.match('iframe') || elem.className.indexOf('iframe') >= 0) {
			this.showLoading();
			this._set_content('<iframe id="fancy_frame" onload="Fancybox.showIframe()" name="fancy_iframe' + Math.round(Math.random()*1000) + '" frameborder="0" hspace="0" src="' + href + '"></iframe>', this.opts.frameWidth, this.opts.frameHeight);
		} else if (href.match(/#/)) {
			var target = window.location.href.split('#')[0];  target = href.replace(target, ''); target = target.substr(target.indexOf('#'));
			var targetel = $$(target)[0];
			this._set_content('<div id="fancy_div">' + (targetel ? targetel.innerHTML : '') + '</div>', this.opts.frameWidth, this.opts.frameHeight);
		} else if (href.match(this.imageRegExp)) {
			this.imagePreloader = new Image;
			this.imagePreloader.src = href;
			
			if (this.imagePreloader.complete) {
				this._proceed_image();
			} else {
				this.showLoading();
				var dis = this;
				this.imagePreloader.onload = function() {
					$('fancy_loading').hide();
					
					dis._proceed_image();
				};
			}
		} else {
			this.showLoading();
			new Ajax.Request(href, {onSuccess: function(data) {
				$('fancy_loading').hide();
				this._set_content('<div id="fancy_ajax">' + data + '</div>', this.opts.frameWidth, this.opts.frameHeight);
			} });
		}
	},
	
	_proceed_image: function() {
		var width = this.imagePreloader.width;
		var height = this.imagePreloader.height;
		
		var horizontal_space = (this.opts.padding * 2) + 40;
		var vertical_space =   (this.opts.padding * 2) + 60;
		
		var w = Fancybox.getViewport();
		
		if (this.opts.imageScale && (width > (w[0] - horizontal_space) || height > (w[1] - vertical_space))) {
			var ratio = Math.min(Math.min(w[0] - horizontal_space, width) / width, Math.min(w[1] - vertical_space, height) / height);

			width	= Math.round(ratio * width);
			height	= Math.round(ratio * height);
		}
		
		this._set_content('<img alt="" id="fancy_img" src="' + this.imagePreloader.src + '" />', width, height);
	},
	
	_preload_neighbor_images: function() {
		if ((this.opts.itemArray.length - 1) > this.opts.itemCurrent) {
			var href = this.opts.itemArray[this.opts.itemCurrent + 1].href || false;
			
			if (href && href.match(this.imageRegExp)) {
				objNext = new Image();
				objNext.src = href;
			}
		}
		
		if (this.opts.itemCurrent > 0) {
			var href = this.opts.itemArray[this.opts.itemCurrent - 1].href || false;
			
			if (href && href.match(this.imageRegExp)) {
				objNext = new Image();
				objNext.src = href;
			}
		}
	},
	
	_set_content: function(value, width, height) {
		this.busy = true;
		
		var pad = this.opts.padding;
		var dis = this;
		
		if (this.oldIE || this.ieQuirks) {
			$('fancy_content').style.removeExpression('height');
			$('fancy_content').style.removeExpression('width');
		}
		
		if (pad > 0) {
			width  += pad * 2;
			height += pad * 2;
			
			$('fancy_content').setStyle({
				top:    pad + 'px',
				right:  pad + 'px',
				bottom: pad + 'px',
				left:   pad + 'px',
				width:  'auto',
				height: 'auto'
			});
			
			if (this.oldIE || this.ieQuirks) {
				$("fancy_content").style.setExpression('height',	'(this.parentNode.clientHeight - '	+ pad * 2 + ')');
				$("fancy_content").style.setExpression('width',		'(this.parentNode.clientWidth - '	+ pad * 2 + ')');
			}
		} else {
			$('fancy_content').setStyle({
				top:    0,
				right:  0,
				bottom: 0,
				left:   0,
				width:  '100%',
				height: '100%'
			});
		}
		
		if ($('fancy_outer').visible() && width == $('fancy_outer').getWidth() && height == $('fancy_outer').getHeight()) {
			$('fancy_content').fade({duration: 0.2, afterFinish: function(){
				$('fancy_content').update(value).appear({duration: 0.4, afterFinish: function(){
					dis._finish();
				}});
			}});
			
			return;
		}
		
		var w = Fancybox.getViewport();
		
		var itemTop		= (height	+ 60) > w[1] ? w[3] : (w[3] + Math.round((w[1] - height	- 60) * 0.5));
		var itemLeft	= (width	+ 40) > w[0] ? w[2] : (w[2] + Math.round((w[0] - width	- 40) * 0.5));
		
		var itemOpts = {
			left: itemLeft + 'px',
			top: itemTop + 'px',
			width: width + 'px',
			height: height + 'px'
		};
		
		if ($('fancy_outer').visible()) {
			$('fancy_content').fade({duration: 0.4, afterFinish: function() {
				$('fancy_content').update();
				$('fancy_outer').morph(itemOpts, {
					duration: dis.opts.zoomSpeedChange,
					transition: dis.opts.easingChange,
					afterFinish: function() {
						$('fancy_content').update(value).appear({duration: 0.4, afterFinish: function() {
							dis._finish();
						}});
					}
				});
			}});
		} else {
			if (this.opts.zoomSpeedIn > 0 && this.opts.itemArray[this.opts.itemCurrent].orig !== undefined) {
				$('fancy_content').update(value);
				
				var orig_item = this.opts.itemArray[this.opts.itemCurrent].orig;
				var orig_pos  = Fancybox.getPosition(orig_item);
				
				$('fancy_outer').setStyle({
					left:   (orig_pos.left - 20 - this.opts.padding) + 'px',
					top:    (orig_pos.top  - 20 - this.opts.padding) + 'px',
					width:  orig_item.getWidth() + (this.opts.padding * 2),
					height: orig_item.getHeight() + (this.opts.padding * 2)
				});
				
				if (this.opts.zoomOpacity) {
					itemOpts.opacity = 1;
				}
				
				$('fancy_outer').morph(itemOpts, {
					duration: this.opts.zoomSpeedIn,
					transition: this.opts.easingIn,
					beforeStart: function() {
						$('fancy_outer').showBlock();
					},
					afterFinish: function() {
						dis._finish();
					}
				});
			} else {
				$('fancy_content').hide().update(value).showBlock();
				$('fancy_outer').setStyle(itemOpts).appear({duration: 0.4, afterFinish: function() {
					dis._finish();
				}});
			}
		}
	},
	
	_set_navigation: function() {
		if (this.opts.itemCurrent !== 0) {
			var dis = this;
			$$('#fancy_left, #fancy_left_ico').each(function(x){
				x.stopObserving();
				x.observe('click', function(e) {
					e.stop();
					
					dis.opts.itemCurrent--;
					dis._change_item();
					
					return false;
				});
			});
			
			$('fancy_left').show();
		}
		
		if (this.opts.itemCurrent != (this.opts.itemArray.length - 1)) {
			var dis = this;
			$$('#fancy_left, #fancy_left_ico').each(function(x){
				x.stopObserving();
				x.observe('click', function(e) {
					e.stop();

					dis.opts.itemCurrent++;
					dis._change_item();

					return false;
				});
			});
			
			$('fancy_right').show();
		}
	},
	
	_finish: function() {
		if (Prototype.Browser.IE) {
			$('fancy_content').style.removeAttribute('filter');
			$('fancy_outer').style.removeAttribute('filter');
		}
		
		this._set_navigation();
		this._preload_neighbor_images();
		
		var dis = this;
		var handler = function(e) {
			if (e.keyCode == 27 && dis.opts.enableEscapeButton) {
				dis.close();
			} else if (e.keyCode == 37 && dis.opts.itemCurrent !== 0) {
				document.stopObserving('keydown', handler);
				dis.opts.itemCurrent--;
				dis._change_item();
			} else if (e.keyCode == 39 && dis.opts.itemCurrent != (dis.opts.itemArray.length - 1)) {
				document.stopObserving('keydown', handler);
				dis.opts.itemCurrent++;
				dis._change_item();
			}
		};
		
		document.observe('keydown', handler);
		
		if (this.opts.hideOnContentClick) {
			$('fancy_content').observe('click', this.close.bind(this));
		}
		
		if (this.opts.overlayShow && this.opts.hideOnOverlayClick) {
			$('fancy_overlay').observe('click', this.close.bind(this));
		}
		
		if (this.opts.showCloseButton) {
			$('fancy_close').observe('click', this.close.bind(this)).showBlock();
		}
		
		if (typeof this.opts.itemArray[this.opts.itemCurrent].title !== 'undefined' && this.opts.itemArray[this.opts.itemCurrent].title.length > 0) {
			var pos = $('fancy_outer').positionedOffset();
			
			$$('#fancy_title div')[0].update(this.opts.itemArray[this.opts.itemCurrent].title);
			
			$('fancy_title').setStyle({
				top: (pos.top + $('fancy_outer').getOuterHeight() - 96) + 'px',
				left: (pos.left + (($('fancy_outer').getOuterWidth() * 0.5) - ($('fancy_title').getWidth() * 0.5)) - 21) + 'px'
			}).showBlock();
		}
		
		if (this.opts.overlayShow && this.IE6) {
			$$('embed, object, select, #fancy_content').setStyle({visibility: 'visible'});
		}
		
		if (Object.isFunction(this.opts.onShow)) {
			this.opts.onShow(this.opts.itemArray[this.opts.itemCurrent]);
		}
		
		if (Prototype.Browser.IE) {
			$('fancy_outer').style.removeAttribute('filter');
			$('fancy_content').style.removeAttribute('filter');
		}
		
		this.busy = false;
	},
	
	scrollBox: function() {
		var w = Fancybox.getViewport();
		
		if (this.opts.centerOnScroll && $('fancy_outer').visible()) {
			var ow = $('fancy_outer').getOuterWidth();
			var oh = $('fancy_outer').getOuterHeight();
			
			var pos = {
				'top'	: (oh > w[1] ? w[3] : w[3] + Math.round((w[1] - oh) * 0.5)),
				'left'	: (ow > w[0] ? w[2] : w[2] + Math.round((w[0] - ow) * 0.5))
			};
			
			$('fancy_outer').setStyle(pos);
			
			$('fancy_title').setStyle({
				top: pos.top + oh - 32,
				left: pos.left + ((ow*0.5) - ($('fancy_title').width() * 0.5))
			});
		}
		
		if (this.IE6 && $('fancy_overlay').visible()) {
			$('fancy_overlay').setStyle({
				height: document.viewport.getHeight()
			});
		}
		
		if ($('fancy_loading').visible()) {
			$('fancy_loading').setStyle({
				'left': ((w[0] - 40) * 0.5 + w[2]),
				'top': ((w[1] - 40) * 0.5 + w[3])
			});
		}
	},
	
	showLoading: function() {
		clearInterval(Fancybox.loadingTimer);

		var w = Fancybox.getViewport();

		$('fancy_loading').setStyle({
			'left': ((w[0] - 40) * 0.5 + w[2]),
			'top': ((w[1] - 40) * 0.5 + w[3])
		}).showBlock();
		$('fancy_loading').observe('click', this.close.bind(this));

		Fancybox.loadingTimer = setInterval(Fancybox.animateLoading, 66);
	},
	
	close: function() {
		this.busy = true;
		
		this.imagePreloader.onload = Prototype.emptyFunction;
		document.stopObserving('resize', this.scrollBox);
		document.stopObserving('scroll', this.scrollBox);
		
		$$("#fancy_overlay, #fancy_content, #fancy_close").each(function(x){
			x.stopObserving();
		});
		
		$$("#fancy_close, #fancy_loading, #fancy_left, #fancy_right, #fancy_title").each(function(x){
			x.hide();
		});
		
		var dis = this;
		__cleanup = function() {
			$('fancy_outer').hide();
			
			if ($('fancy_overlay').visible()) {
				$('fancy_overlay').fade({duration: 0.2});
			}
			
			$('fancy_content').update();
			
			if (dis.opts.centerOnScroll) {
				document.stopObserving('resize', this.scrollBox);
				document.stopObserving('scroll', this.scrollBox);
			}
			
			if (dis.IE6) {
				$$('embed, object, select').setStyle({visibility: 'visible'});
			}
			
			if (Object.isFunction(dis.opts.onClose)) {
				dis.opts.onClose();
			}
			
			dis.busy = false;
		};
		
		if ($('fancy_outer').visible() !== false) {
			if (this.opts.zoomSpeedOut > 0 && this.opts.itemArray[this.opts.itemCurrent].orig !== undefined) {
				var orig_item = this.opts.itemArray[this.opts.itemCurrent].orig;
				var orig_pos = Fancybox.getPosition(orig_item);
				
				var itemOpts = {
					'left':		(orig_pos.left	- 20 - opts.padding) + 'px',
					'top': 		(orig_pos.top	- 20 - opts.padding) + 'px',
					'width':	orig_item.getWidth() + (opts.padding * 2),
					'height':	orig_item.getHeight() + (opts.padding * 2)
				};
				
				if (this.opts.zoomOpacity) {
					itemOpts.opacity = 0;
				}
				
				$('fancy_outer').morph(itemOpts, {
					duration: this.opts.zoomSpeedOut,
					transition: this.opts.easingOut,
					afterFinish: __cleanup
				});
			} else {
				$('fancy_outer').fade({duration: 0.2, afterFinish: __cleanup});
			}
		} else {
			__cleanup();
		}
		
		return false;
	}
});

Fancybox.loadingFrame = 1;

Fancybox.getNumeric = function(el, prop) {
	return parseInt($(el).getStyle(prop)) || 0;
};

Fancybox.getPosition = function(el) {
	var pos = $(el).cumulativeOffset();
	
	pos.top += Fancybox.getNumeric(el, 'padding-top');
	pos.top += Fancybox.getNumeric(el, 'border-top-width');
	
	pos.left += Fancybox.getNumeric(el, 'padding-left');
	pos.left += Fancybox.getNumeric(el, 'border-left-width');
	
	return pos;
};


Fancybox.showIframe = function() {
	$('fancy_loading').hide();
	$('fancy_frame').showBlock();
};

Fancybox.getViewport = function() {
	var scr = document.viewport.getScrollOffsets();
	return [document.viewport.getWidth(), document.viewport.getHeight(), scr.left, scr.top];
};

Fancybox.animateLoading = function() {
	if (!$('fancy_loading').visible()) {
		clearInterval(Fancybox.loadingTimer);
		return;
	}
	
	$$('#fancy_loading > div')[0].setStyle({
		top: (Fancybox.loadingFrame * -40) + 'px'
	});
	
	Fancybox.loadingFrame = (Fancybox.loadingFrame + 1) % 12;
};

Fancybox.build = function() {
	var html = '';

	html += '<div id="fancy_overlay"></div>';
	html += '<div id="fancy_loading"><div></div></div>';

	html += '<div id="fancy_outer" style="display: none">';
	html += '<div id="fancy_inner">';

	html += '<div id="fancy_close"></div>';

	html += '<div id="fancy_bg"><div class="fancy_bg" id="fancy_bg_n"></div><div class="fancy_bg" id="fancy_bg_ne"></div><div class="fancy_bg" id="fancy_bg_e"></div><div class="fancy_bg" id="fancy_bg_se"></div><div class="fancy_bg" id="fancy_bg_s"></div><div class="fancy_bg" id="fancy_bg_sw"></div><div class="fancy_bg" id="fancy_bg_w"></div><div class="fancy_bg" id="fancy_bg_nw"></div></div>';

	html += '<a href="javascript:;" id="fancy_left"><span class="fancy_ico" id="fancy_left_ico"></span></a><a href="javascript:;" id="fancy_right"><span class="fancy_ico" id="fancy_right_ico"></span></a>';

	html += '<div id="fancy_content"></div>';

	html += '</div>';
	html += '</div>';
	
	html += '<div id="fancy_title"></div>';
	
	$$('body')[0].insert(html);
	
	$('fancy_title').insert('<table cellspacing="0" cellpadding="0" border="0"><tr><td class="fancy_title" id="fancy_title_left"></td><td class="fancy_title" id="fancy_title_main"><div></div></td><td class="fancy_title" id="fancy_title_right"></td></tr></table>');
	
	// Here should be the PNG fix
	
	if (Prototype.Browser.IE && (parseInt(navigator.userAgent.substring(navigator.userAgent.indexOf("MSIE")+5))==6)) {
		$('fancy_overlay').setStyle({position: 'absolute'});
		// Again a PNG fix
		
		$('#fancy_inner').insert({
			'top': '<iframe id="fancy_bigIframe" src="javascript:false;" scrolling="no" frameborder="0"></iframe>'
		});
		
		// Get rid of the 'false' text introduced by the URL of the iframe
		var frameDoc = $('fancy_bigIframe')[0].contentWindow.document;
		frameDoc.open();
		frameDoc.close();
	}
};

document.observe('dom:loaded', function(){
	if (!$('fancy_outer')) {
		Fancybox.build();
	}
});