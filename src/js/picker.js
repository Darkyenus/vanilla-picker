/*global HTMLElement*/

import Color from '@sphinxxxx/color-conversion';
import * as utils from './utils.js';


//https://stackoverflow.com/a/51117224/1869660
const BG_TRANSP = `linear-gradient(45deg, lightgrey 25%, transparent 25%, transparent 75%, lightgrey 75%) 0 0 / 2em 2em,
                   linear-gradient(45deg, lightgrey 25%,       white 25%,       white 75%, lightgrey 75%) 1em 1em / 2em 2em`;
const HUES = 360;
//We need to use keydown instead of keypress to handle Esc from the editor textbox:
const EVENT_KEY = 'keydown';


function $(selector, context) {
    return (context || document).querySelector(selector);
}

function onKey(bucket, target, keys, handler, stop) {
    bucket.add(target, EVENT_KEY, function(e) {
        if(keys.indexOf(e.key) >= 0) {
            if(stop) {
                //Stop an event from bubbling up to the parent:
                e.preventDefault();
                e.stopPropagation();
            }
            handler(e);
        }
    }, { passive: false });
}


class Picker {

    //https://stackoverflow.com/questions/24214962/whats-the-proper-way-to-document-callbacks-with-jsdoc
    /**
     * A callback that gets the picker's current color value.
     * 
     * @callback Picker~colorCallback
     * @param {Object} color
     * @param {number[]} color.rgba       - RGBA color components.
     * @param {number[]} color.hsla       - HSLA color components (all values between 0 and 1, inclusive).
     * @param {string}   color.rgbString  - RGB CSS value (e.g. `rgb(255,215,0)`).
     * @param {string}   color.rgbaString - RGBA CSS value (e.g. `rgba(255,215,0, .5)`).
     * @param {string}   color.hslString  - HSL CSS value (e.g. `hsl(50.6,100%,50%)`).
     * @param {string}   color.hslaString - HSLA CSS value (e.g. `hsla(50.6,100%,50%, .5)`).
     * @param {string}   color.hex        - 8 digit #RRGGBBAA (not supported in all browsers).
     */

    /**
     * Create a color picker.
     * 
     * @example
     * var picker = new Picker(myParentElement);
     * picker.onDone = function(color) {
     *     myParentElement.style.backgroundColor = color.rgbaString;
     * };
     * 
     * @example
     * var picker = new Picker({
     *     parent: myParentElement,
     *     color: 'gold',
     *     onChange: function(color) {
     *                   myParentElement.style.backgroundColor = color.rgbaString;
     *               },
     * });
     * 
     * @param {Object} options - @see {@linkcode Picker#setOptions|setOptions()}
     */
    constructor(options) {
        // Colour alias for backward compatibility
        const that = this;
        Object.defineProperty(this, 'colour', {
            get() { return that.color; },
            set(value) { that.color = value; }
        });

        //Default settings
        this.settings = {
            //Allow creating a popup without putting it on screen yet.
            //  parent: document.body,
            popup: 'right',
            layout: 'default',
            alpha:  true,
            editor: true,
            editorFormat: 'hex',
            cancelButton: false,
            defaultColor: '#0cf'
        };
        
        this._events = new utils.EventBucket();

        /**
         * Callback whenever the color changes.
         * @member {Picker~colorCallback}
         */
        this.onChange = null;
        /**
         * Callback when the user clicks "Ok".
         * @member {Picker~colorCallback}
         */
        this.onDone = null;
        /**
         * Callback when the popup opens.
         * @member {Picker~colorCallback}
         */
        this.onOpen = null;
        /**
         * Callback when the popup closes.
         * @member {Picker~colorCallback}
         */
        this.onClose = null;
        
        this.setOptions(options);
    }


    /**
     * Set the picker options.
     * 
     * @param {Object}       options
     * @param {HTMLElement}  options.parent           - Which element the picker should be attached to.
     * @param {('top'|'bottom'|'left'|'right'|false)}
     *                       [options.popup=right]    - If the picker is used as a popup, where to place it relative to the parent. `false` to add the picker as a normal child element of the parent.
     * @param {boolean}      [options.manualPopup]    - Set to true to suppress automatic click-to-open event registration when you want to use picker as a popup, but want to control when it opens manually
     * @param {string}       [options.template]       - Custom HTML string from which to build the picker. See /src/picker.pug for required elements and class names.
     * @param {string}       [options.layout=default] - Suffix of a custom "layout_..." CSS class to handle the overall arrangement of the picker elements.
     * @param {boolean}      [options.alpha=true]     - Whether to enable adjusting the alpha channel.
     * @param {boolean}      [options.editor=true]    - Whether to show a text field for color value editing.
     * @param {('hex'|'hsl'|'rgb')}
     *                       [options.editorFormat=hex] - How to display the selected color in the text field (the text field still supports *input* in any format).
     * @param {boolean}      [options.cancelButton=false] - Whether to have a "Cancel" button which closes the popup.
     * @param {string}       [options.color]          - Initial color for the picker.
     * @param {function}     [options.onChange]       - @see {@linkcode Picker#onChange|onChange}
     * @param {function}     [options.onDone]         - @see {@linkcode Picker#onDone|onDone}
     * @param {function}     [options.onOpen]         - @see {@linkcode Picker#onOpen|onOpen}
     * @param {function}     [options.onClose]        - @see {@linkcode Picker#onClose|onClose}
     */
    setOptions(options) {
        if(!options) { return; }
        const settings = this.settings;

        function transfer(source, target, skipKeys) {
            for (const key in source) {
                if(skipKeys && (skipKeys.indexOf(key) >= 0)) { continue; }

                target[key] = source[key];
            }
        }

        if(options instanceof HTMLElement) {
            settings.parent = options;
        }
        else {
            //const skipKeys = [];
            //
            //if(options.popup instanceof Object) {
            //    transfer(options.popup, settings.popup);
            //    skipKeys.push('popup');
            //}
            
            /* //TODO: options.layout -> Object
            {
                mode: 'hsla',       //'hsla', 'hasl', 'hsl'. Deprecate options.alpha
                verticalHue: false,
                verticalAlpha: true,
                alphaOnSL: false,
                editor: true,       //Deprecate options.editor
                css: undefined,     //Same as old options.layout. Default from mode
                //.template as well?
            }
            //*/
            
            //New parent?
            if(settings.parent && options.parent && (settings.parent !== options.parent)) {
                this._events.remove(settings.parent); //.removeEventListener('click', this._openProxy, false);
                this._popupInited = false;
            }

            transfer(options, settings/*, skipKeys*/);
        
            //Event callbacks. Hook these up before setColor() below,
            //because we'll need to fire onChange() if there is a color in the options
            if(options.onChange) { this.onChange = options.onChange; }
            if(options.onDone)   { this.onDone   = options.onDone; }
            if(options.onOpen)   { this.onOpen   = options.onOpen; }
            if(options.onClose)  { this.onClose  = options.onClose; }
        
            //Note: Look for color in 'options', as a color value in 'settings' may be an old one we don't want to revert to.
            const col = options.color || options.colour;
            if(col) { this._setColor(col); }
        }
        
        //Init popup behavior once we have all the parts we need:
        const parent = settings.parent;
        if(parent && settings.popup && !settings.manualPopup && !this._popupInited) {

            //Keep openHandler() pluggable, but call it in the right context:
            const openProxy = (e) => this.openHandler(e);

            this._events.add(parent, 'click', openProxy, { passive: false });

            //Keyboard navigation: Open on [Space] or [Enter] (but stop the event to avoid typing a " " in the editor textbox).
            //No, don't stop the event, as that would disable normal input behavior (typing a " " or clicking the Ok button with [Enter]).
            //Fix: setTimeout() in openHandler()..
            //
            //https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values#Whitespace_keys
            onKey(this._events, parent, [' ', 'Spacebar', 'Enter'], openProxy/*, true*/);

            this._popupInited = true;
        }
        else if(options.parent && !settings.popup) {
            this.show();
        }
    }


    /**
     * Default behavior for opening the popup
     */
    openHandler(e) {
        if(this.show()) {
            //If the parent is an <a href="#"> element, avoid scrolling to the top:
            e && e.preventDefault();
            
            //A trick to avoid re-opening the dialog if you click the parent element while the dialog is open:
            this.settings.parent.style.pointerEvents = 'none';

            //Recommended popup behavior with keyboard navigation from http://whatsock.com/tsg/Coding%20Arena/Popups/Popup%20(Internal%20Content)/demo.htm
            //Wait a little before focusing the textbox, in case the dialog was just opened with [Space] (would overwrite the color value with a " "):
            const toFocus = (e && (e.type === EVENT_KEY)) ? this._domEdit : this.domElement;
            setTimeout(() => toFocus.focus(), 100);

            if(this.onOpen) { this.onOpen(this.color); }
        }
    }


    /**
     * Default behavior for closing the popup
     *
     * @param {boolean} returnFocus - Whether to return the focus to the parent element
     */
    closeHandler(returnFocus) {
        if(this.hide()) {
            this.settings.parent.style.pointerEvents = '';

            //Recommended popup behavior from http://whatsock.com/tsg/Coding%20Arena/Popups/Popup%20(Internal%20Content)/demo.htm
            //However, we don't re-focus the parent if the user closes the popup by clicking somewhere else on the screen,
            //because they may have scrolled to a different part of the page by then, and focusing would then inadvertently scroll the parent back into view:
            if (returnFocus && this.settings.parent && !this.settings.manualPopup) {
                this.settings.parent.focus();
            }

            if(this.onClose) { this.onClose(this.color); }
        }
    }


    /**
     * Move the popup to a different parent, optionally opening it at the same time.
     *
     * @param {Object}  options - @see {@linkcode Picker#setOptions|setOptions()} (Usually a new `.parent` and `.color`).
     * @param {boolean} open    - Whether to open the popup immediately.
     */
    movePopup(options, open) {
        //Cleanup if the popup is currently open (at least revert the current parent's .pointerEvents);
        this.closeHandler(false);
        
        this.setOptions(options);
        if(open) {
            this.openHandler();
        }
    }


    /**
     * Set/initialize the picker's color.
     * 
     * @param {string}  color  - Color name, RGBA/HSLA/HEX string, or RGBA array.
     * @param {boolean} silent - If true, won't trigger onChange.
     */
    setColor(color, silent) {
        this._setColor(color, { silent: silent });
    }
    _setColor(color, flags) {
        if(typeof color === 'string') { color = color.trim(); }
        if (!color) { return; }

        flags = flags || {};
        let c;
        try {
            //Will throw on unknown colors:
            c = new Color(color);
        }
        catch (ex) {
            if(flags.failSilently) { return; }
            throw ex;
        }

        if(!this.settings.alpha) {
            const hsla = c.hsla;
            hsla[3] = 1;
            c.hsla = hsla;
        }
        this.color = c;
        this._setHSLA(null, null, null, null, flags);
    }
    /**
     * @see {@linkcode Picker#setColor|setColor()}
     */
    setColour(color, silent) {
        this.setColor(color, silent);
    }


    /**
     * Show/open the picker.
     */
    show() {
        const parent = this.settings.parent;
        if(!parent) { return false; }
        
        //Unhide html if it exists
        if(this.domElement) {
            const toggled = this._toggleDOM(true);

            //Things could have changed through setOptions():
            this._setPosition();

            return toggled;
        }

        const html = this.settings.template || `## PLACEHOLDER-HTML ##`;
        const wrapper = utils.parseHTML(html);
        
        this.domElement = wrapper;
        this._domH      = $('.picker_hue', wrapper);
        this._domSL     = $('.picker_sl', wrapper);
        this._domA      = $('.picker_alpha', wrapper);
        this._domEdit   = $('.picker_editor input', wrapper);
        this._domSample = $('.picker_sample', wrapper);
        this._domOkay   = $('.picker_done button', wrapper);
        this._domCancel = $('.picker_cancel button', wrapper);

        wrapper.classList.add('layout_' + this.settings.layout);
        if(!this.settings.alpha) { wrapper.classList.add('no_alpha'); }
        if(!this.settings.editor) { wrapper.classList.add('no_editor'); }
        if(!this.settings.cancelButton) { wrapper.classList.add('no_cancel'); }
        this._ifPopup(() => wrapper.classList.add('popup'));
        
        this._setPosition();


        if(this.color) {
            this._updateUI();
        }
        else {
            this._setColor(this.settings.defaultColor);
        }
        this._bindEvents();
        
        return true;
    }


    /**
     * Hide the picker.
     */
    hide() {
        return this._toggleDOM(false);
    }
    
    
    /**
     * Release all resources used by this picker instance.
     */
    destroy() {
        this.closeHandler(true);
        this._events.destroy();
        if(this.domElement) {
            this.settings.parent.removeChild(this.domElement);
        }
    }


    /*
     * Handle user input.
     * 
     * @private
     */
    _bindEvents() {
        const that = this,
              dom = this.domElement,
              events = this._events;
        
        function addEvent(target, type, handler, options) {
            events.add(target, type, handler, options);
        }
        
        
        //Prevent clicks while dragging from bubbling up to the parent:
        addEvent(dom, 'click', e => e.preventDefault(), { passive: false });


        /* Draggable color selection */

        //Select hue
        utils.dragTrack(events, this._domH,  (x, y) => that._setHSLA(x));

        //Select saturation/lightness
        utils.dragTrack(events, this._domSL, (x, y) => that._setHSLA(null, x, 1 - y));

        //Select alpha
        if(this.settings.alpha) {
            utils.dragTrack(events, this._domA,  (x, y) => that._setHSLA(null, null, null, 1 - y));
        }
        
        
        /* Direct color value editing */

        //Always init the editor, for accessibility and screen readers (we'll hide it with CSS if `!settings.editor`)
        const editInput = this._domEdit;
        /*if(this.settings.editor)*/ {
            addEvent(editInput, 'input', function(e) {
                that._setColor(this.value, { fromEditor: true, failSilently: true });
            }, { passive: true });
            //Select all text on focus:
            addEvent(editInput, 'focus', function(e) {
                const input = this;
                //If no current selection:
                if(input.selectionStart === input.selectionEnd) {
                    input.select();
                }
            }, { passive: true });
        }


        /* Close the dialog */

        //onClose:
        this._ifPopup(() => {
            addEvent(dom, 'blur', () => { that._closeTimeoutId = setTimeout(() => that.closeHandler(false), 0); },{ passive: true, capture: true });
            addEvent(dom, 'focus', () => clearTimeout(that._closeTimeoutId), { passive: true, capture: true });
            onKey(events, dom, ['Esc', 'Escape'], () => that.closeHandler(true), { passive: true });
            
            //Cancel button:
            addEvent(this._domCancel, 'click', () => that.closeHandler(true), { passive: true });
        });

        //onDone:
        const onDoneProxy = (e) => {
            that._ifPopup(() => that.closeHandler(true));
            if (that.onDone) { that.onDone(that.color); }
        };
        addEvent(this._domOkay, 'click',   onDoneProxy, { passive: true });
        onKey(events, dom,      ['Enter'], onDoneProxy);
    }


    /*
     * Position the picker on screen.
     * 
     * @private
     */
    _setPosition() {
        const parent = this.settings.parent,
              elm = this.domElement;

        if(parent !== elm.parentNode) { parent.appendChild(elm); }

        this._ifPopup((popup) => {

            //Allow for absolute positioning of the picker popup:
            if(getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }

            const cssClass = (popup === true) ? 'popup_right' : 'popup_' + popup;

            ['popup_top', 'popup_bottom', 'popup_left', 'popup_right'].forEach(c => {
                //Because IE doesn't support .classList.toggle()'s second argument...
                if(c === cssClass) {
                    elm.classList.add(c);
                }
                else {
                    elm.classList.remove(c);
                }
            });

            //Allow for custom placement via CSS:
            elm.classList.add(cssClass);
        });
    }


    /*
     * "Hub" for all color changes
     * 
     * @private
     */
    _setHSLA(h, s, l, a,  flags) {
        flags = flags || {};

        const col = this.color,
              hsla = col.hsla;

        [h, s, l, a].forEach((x, i) => {
            if(x || (x === 0)) { hsla[i] = x; }
        });
        col.hsla = hsla;

        this._updateUI(flags);

        if(this.onChange && !flags.silent) { this.onChange(col); }
    }

    _updateUI(flags) {
        if(!this.domElement) { return; }
        flags = flags || {};

        const col = this.color,
              hsl = col.hsla,
              cssHue  = `hsl(${hsl[0] * HUES}, 100%, 50%)`,
              cssHSL  = col.hslString,
              cssHSLA = col.hslaString;

        const uiH  = this._domH,
              uiSL = this._domSL,
              uiA  = this._domA,
              thumbH  = $('.picker_selector', uiH),
              thumbSL = $('.picker_selector', uiSL),
              thumbA  = $('.picker_selector', uiA);
        
        function posX(parent, child, relX) {
            child.style.left = (relX * 100) + '%'; //(parent.clientWidth * relX) + 'px';
        }
        function posY(parent, child, relY) {
            child.style.top  = (relY * 100) + '%'; //(parent.clientHeight * relY) + 'px';
        }


        /* Hue */
        
        posX(uiH, thumbH, hsl[0]);
        
        //Use the fully saturated hue on the SL panel and Hue thumb:
        this._domSL.style.backgroundColor = this._domH.style.color = cssHue;


        /* S/L */
        
        posX(uiSL, thumbSL, hsl[1]);
        posY(uiSL, thumbSL, 1 - hsl[2]);
        
        //Use the opaque HSL on the SL thumb:
        uiSL.style.color = cssHSL;


        /* Alpha */
        
        posY(uiA,  thumbA,  1 - hsl[3]);

        const opaque = cssHSL,
              transp = opaque.replace('hsl', 'hsla').replace(')', ', 0)'),
              bg = `linear-gradient(${[opaque, transp]})`;

        //Let the Alpha slider fade from opaque to transparent:
        this._domA.style.background = bg + ', ' + BG_TRANSP;


        /* Editable value */
        
        //Don't update the editor if the user is typing.
        //That creates too much noise because of our auto-expansion of 3/4/6 -> 8 digit hex codes.
        if(!flags.fromEditor) {
            const format = this.settings.editorFormat,
                  alpha = this.settings.alpha;

            let value;
            switch (format) {
                case 'rgb': value = col.printRGB(alpha); break;
                case 'hsl': value = col.printHSL(alpha); break;
                default:    value = col.printHex(alpha);
            }
            this._domEdit.value = value;
        }


        /* Sample swatch */
        
        this._domSample.style.color = cssHSLA;
    }
    
    
    _ifPopup(actionIf, actionElse) {
        if(this.settings.parent && this.settings.popup) {
            actionIf && actionIf(this.settings.popup);
        }
        else {
            actionElse && actionElse();
        }
    }


    _toggleDOM(toVisible) {
        const dom = this.domElement;
        if(!dom) { return false; }

        const displayStyle = toVisible ? '' : 'none',
              toggle = (dom.style.display !== displayStyle);
        
        if(toggle) { dom.style.display = displayStyle; }
        return toggle;
    }


/*
    //Feature: settings to flip hue & alpha 90deg (i.e. vertical or horizontal mode)
    
    
        function createDragConfig(container, callbackRelative) {
const flipped = true;

            function capRel(val) {
                return (val < 0) ? 0
                                 : (val > 1) ? 1 : val;
            }

            //Convert the px coordinates to relative coordinates (0-1) before invoking the callback:
            function relayDrag(_, pos) {
                const w = container.clientWidth,
                      h = container.clientHeight;
                      
                const relX = pos[0]/(flipped ? h : w),
                      relY = pos[1]/(flipped ? w : h);
                      
                callbackRelative(capRel(relX), capRel(relY));
            }

            const config = {
                container:     container,
                //dragOutside:   false,
                callback:      relayDrag,
                //Respond at once (mousedown), don't wait for click or drag:
                callbackDragStart: relayDrag,
            };
            return config;
        }
*/
}

/* Inject the default CSS (if we're not building for strict CSP settings)  */
if ('## PLACEHOLDER-CSS-SECTION ##') {
    const style = document.createElement('style');
    style.textContent = `## PLACEHOLDER-CSS ##`;
    document.documentElement.firstElementChild //<head>, or <body> if there is no <head>
        .appendChild(style);

    /**
     * The `<style>` element for picker CSS which is added to the document.
     */
    Picker.StyleElement = style;
}


export default Picker;
