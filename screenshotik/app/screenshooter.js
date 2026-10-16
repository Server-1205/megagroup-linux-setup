//'use strict';

const {desktopCapturer, ipcRenderer, screen, shell} = require('electron');
const conf = require('./conf');
const {capture} = require('./capture');
const {pathToFileURL} = require('url');
//import {default as db} from 'storage';

class Button {

    constructor(action = {
        onclick: function () {
        }
    }, {
                    normalClass,
                    disabledClass,
                    focusedClass
                } =
                    {
                        normalClass: "panel-btn",
                        disabledClass: "panel-btn-disabled",
                        focusedClass: "panel-btn-active"
                    }, selector = null) {

        this._classes = {
            normal: normalClass,
            disabled: disabledClass,
            focused: focusedClass
        };
        this.selector = selector;
        if (!selector) {
            this._element = document.createElement('a');
            //this._element.setAttribute('aria-hidden', true);
            this._element.className = normalClass;
        } else {
            this._element = document.querySelector(this.selector);
        }
        //this._element.style.backgroundImage = normalIcon;
        this._currentState = 'normal';
        this._action = action;
    }

    action(key) {
        if (this.hasAction(key)) {
            this._action[key]();
            return true;
        } else {
            return false;
        }
    }

    hasAction(key) {
        return this._action.hasOwnProperty(key) && typeof this._action[key] === 'function';
    }

    enable(enable) {
        if (enable && this._currentState == 'disabled') {
            if (this._classes.normal) {
                this._element.className = this._classes.normal;
            }
            //this._element.style.backgroundImage = this._icons.normal;
            this._currentState = 'normal';
        } else {
            if (this._classes.normal||this._classes.disabled) {
                this._element.className = this._classes.normal + " " + this._classes.disabled;
            }
            //this._element.style.backgroundImage = this._icons.disabled;
            this._currentState = 'disabled';
        }
    }

    focus() {
        if (this._classes.normal || this.classes.focused) {
            this._element.className = this._classes.normal + " " + this._classes.focused;
        }
        //this._element.style.backgroundImage = this._icons.focused;
        this._currentState = 'focused';
    }

    releaseFocus() {
        if (this._classes.normal) {
            this._element.className = this._classes.normal;
        }
        //this._element.style.backgroundImage = this._icons.normal;
        this._currentState = 'normal';
    }

    isEnabled() {
        return this._currentState !== 'disabled';
    }

    isFocused() {
        return this._currentState === 'focused';
    }
}

class Panel {

    constructor(el, _screenShooter) {
        //console.log('panel constructor');
        this._buttonsElements = new Map();
        this._buttons = new Map();
        this._screenShooter = _screenShooter;
        if (typeof el === 'string') {
            this._element = document.querySelector(el);
        } else {
            this._element = el;
        }

        if (this._element && conf.get(this._screenShooter.display.id + 'panelX')) {
            this._element.style.left = conf.get(this._screenShooter.display.id + 'panelX');
            this._element.style.top = conf.get(this._screenShooter.display.id + 'panelY');
        }

        this._element.style.display = 'block';

        window.setTimeout(()=>{
            if (this._element.offsetWidth + this._element.offsetLeft > this._screenShooter.display.bounds.width) {
                this._element.style.left = (this._screenShooter.display.bounds.width - this._element.offsetWidth) + 'px';
            }
            if (this._element.offsetHeight + this._element.offsetTop > this._screenShooter.display.bounds.height) {
                this._element.style.top = (this._screenShooter.display.bounds.height - this._element.offsetHeight) + 'px';
            }
            if (this._element.offsetLeft < 0) {
                this._element.style.left = '0px';
            }
            if (this._element.offsetTop < 0) {
                this._element.style.top = '0px';
            }

        },0);

        this._element.addEventListener('mousedown', (event) => {
            if (this._element === event.target || (this._element.contains(event.target) && !(event.target instanceof HTMLInputElement))) {
                event.preventDefault();
                this._deltaX = event.pageX - this._element.offsetLeft;
                this._deltaY = event.pageY - this._element.offsetTop;
                var dragIt = (e) => {
                    var x = e.pageX - this._deltaX + 'px';
                    var y = e.pageY - this._deltaY + 'px';
                    this._element.style.left = x;
                    this._element.style.top = y;
                    conf.set(this._screenShooter.display.id + 'panelX', x);
                    conf.set(this._screenShooter.display.id + 'panelY', y);
                };
                window.addEventListener('mouseup', function () {
                    document.removeEventListener('mousemove', dragIt, false);
                }, false);
                document.addEventListener('mousemove', dragIt, false);
            }
        });
    }

    actionEventListener(event) {
        //console.log('actionEventListener');
        if (this._buttons.get(event.target) && this._buttons.get(event.target).hasAction(event.type)) {
            if (this._buttons.get(event.target).action(event.type)) {
                event.preventDefault();
            }
        }
    }

    addPluginButton(plugin, button) {
        //button.panel = this;
        this._buttonsElements.set(button._element, plugin);
        this._buttons.set(button._element, button);
        if (!this._element.contains(button._element)) {
            this._element.querySelector('.panel-top').appendChild(button._element);
        }
        for (let i in button._action) {
            button._element.addEventListener(i, this.actionEventListener.bind(this));
        }
    }
}


class Plugin {

    constructor(screenShooter) {
        this._screenShooter = screenShooter;
        this._canvas = this._screenShooter.canvas;
        this._pannel = this._screenShooter.panel;
        this._isFocused = false;
        this._pluginButton = null;
        this._initialize();
    }


    changeObjectColor(object, color) {
        return object;
    }

    changeObjectSize(object, size) {
        return object;
    }

    removeObject(object) {
        this._canvas.remove(object);
    }

    getOtherPlugin(plugin) {
        return this._screenShooter.getPlugin(plugin);
    }

    hasOwnColor() {
        return false;
    }

    hasOwnSize() {
        return true;
    }

    _initialize() {
    }

    canFocus() {
        return true;
    }

    hasFocus() {
        return this.canFocus() && this.isFocused;
    }

    focus() {
        if (this.canFocus()) {
            if (this._screenShooter.currentPlugin) {
                this._screenShooter.currentPlugin.releaseFocus();
            }
            this._screenShooter.currentPlugin = this;
            this.isFocused = true;
            this._screenShooter.colorInput.value = this.getColor();
            this._screenShooter.sizeInput.value = this.getSize();
            this._pluginButton.focus();
        }
    }

    releaseFocus() {
        if (this.hasFocus()) {
            if (this._screenShooter.currentPlugin === this) {
                if (this._pluginButton) this._pluginButton.releaseFocus();
            }
            this.isFocused = false;
            this._screenShooter.currentPlugin = null;
        }
    }

    onKeyUp() {
        return true;
    }


    getDefaultColor() {
        return '#BC0000';
    }

    getDefaultSize() {
        return 3;
    }

    getSize() {
        if (!conf.has(this.getSizeSettingName())) {
            this.setSize(this.getDefaultSize());
        }
        return Math.round(Number(conf.get(this.getSizeSettingName())));
    }

    setSize(size) {
        conf.set(this.getSizeSettingName(), Math.round(Number(size)));
    }


    getSizeSettingName() {
        if (this.hasOwnSize()) {
            return this.constructor.name + 'Size';
        }
        return 'Size';
    }

    getColorSettingName() {
        if (this.hasOwnColor()) {
            return this.constructor.name + 'Color';
        }
        return 'Color';
    }

    getColor() {
        if (!conf.has(this.getColorSettingName())) {
            this.setColor(this.getDefaultColor());
        }
        return conf.get(this.getColorSettingName());
    }

    setColor(color) {
        conf.set(this.getColorSettingName(), color);
    }

    /*onMouseDown(event) {
    }

    onMouseUp(event) {
    }

    onMouseMove(event) {
    }*/

    onKeyDown(event) {

    }

    switchInterfaceState() {

    }

}


class SelectPlugin extends Plugin {

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},
            {
                normalClass: "panel-btn ico-move",
                disabledClass: "panel-btn-disabled",
                focusedClass: "panel-btn-active"
            });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            /*
            if (this._screenShooter.currentPlugin) {
                this._screenShooter.currentPlugin.releaseFocus();
            }
            this._pluginButton.focus();
            this._screenShooter.currentPlugin = this;
            //this._screenShooter.canvas.selection = true;*/
            this._screenShooter.makeAllSelectable();
        }
    }

    releaseFocus() {
        super.releaseFocus();
        //this._pluginButton.releaseFocus();
        //this._screenShooter.currentPlugin = null;
        this._screenShooter.canvas.selection = false;
        this._screenShooter.makeAllUnselectable();
    }
}

class ExpandPlugin extends Plugin {

    _initialize() {
        this._pluginButton = new Button({click: this.toggleExpand.bind(this)},
            {
                normalClass: "panel-btn ico-full-screen",
                disabledClass: "panel-btn-disabled",
                focusedClass: "panel-btn-active"
            });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._expanded = false;
    }

    canFocus() {
        return false;
    }

    toggleExpand() {
        if (this._pluginButton.isEnabled()) {
            this._screenShooter.toggleFullScreen();
        }
    }
}


class ArrowPlugin extends Plugin {


    changeObjectColor(object, color) {
        object.set('fill', color);
    }

    changeObjectSize(object, size) {
        object.set('weight', size / 3);
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},
            {
                normalClass: "panel-btn ico-arrows",
                disabledClass: "panel-btn-disabled",
                focusedClass: "panel-btn-active"
            });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._object = new fabric.Arrow([0, 0, 1, 1], {
                        fill: this.getColor(),
                        shadow: {color: 'rgba(0,0,0,0.3)', offsetX: 1, offsetY: 1},
                        left: options.e.clientX,
                        top: options.e.clientY,
                        weight: this.getSize() / 3,
                        plugin: this.constructor.name
                    });
                    this._screenShooter.canvas.add(this._object).setActiveObject(this._object);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    //this._screenShooter.canvas.add(this._object);
                }
                return false;
            } else if (options.target) {
                console.log(options.target);
            }
            console.log(options);
        };

        this.onMouseMove = (options) => {
            //this._screenShooter.canvas.getActiveObjects().set('x2', options.e.clientX - this._object.get('left')).set
            this._object.set('x2', options.e.clientX - this._object.get('left'));
            this._object.set('y2', options.e.clientY - this._object.get('top'));
            this._screenShooter.canvas.renderAll();

        };

        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            this._object.set('evented', false);
            //this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            //this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }


    /*
    action() {


        console.log("arrow");
        var poly = new Arrow([0,0,0,0], {
            stroke: 'blue',
            fill: 'red',
            left: 100,
            top: 100
        });
        this._screenShooter.canvas.add(poly);
    }*/


    //d="M20.689,4.25l-6.189,0c-0.414,0 -0.75,-0.336 -0.75,-0.75c0,-0.414 0.336,-0.75 0.75,-0.75l8,0c0.414,0 0.75,0.336 0.75,0.75l0,8c0,0.414 -0.336,0.75 -0.75,0.75c-0.414,0 -0.75,-0.336 -0.75,-0.75l0,-6.189l-17.72,17.719c-0.293,0.293 -0.767,0.293 -1.06,0c-0.293,-0.293 -0.293,-0.767 0,-1.06l17.719,-17.72Z"

}

class BlurPlugin extends Plugin {

    hasOwnColor() {
        return true;
    }

    getDefaultColor() {
        return '#ffe599';
    }

    changeObjectColor(object, color) {
        if (this._canvas.getActiveObjects().length === 1) {
            object.set('fill', color);
        }
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},{
            normalClass: "panel-btn ico-rect-fill",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._clickX = options.e.clientX;
                    this._clickY = options.e.clientY;

                    this._object = new fabric.Rect({
                        fill: this.getColor(),
                        left: this._clickX,
                        top: this._clickY,
                        width: 0,
                        height: 0,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    });

                    this._screenShooter.canvas.add(this._object).setActiveObject(this._object);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    this._inMove = false;

                }
                return false;
            } else if (options.target) {
                console.log(options.target);
            }
            console.log(options);
        };

        this.onMouseMove = (options) => {

            //if (!this._inMove) {
            //    this._inMove = true;
            let currentWidth = options.e.clientX - this._clickX;
            let currentHeight = options.e.clientY - this._clickY;
            let left = this._clickX;
            let top = this._clickY;
            if (currentWidth < 0) {
                left = options.e.clientX;
            } else {
                //left = this._clickX - this._object.strokeWidth;
            }

            if (currentHeight < 0) {
                top = options.e.clientY;
            } else {
                //top = this._clickY - this._object.strokeWidth;
            }

            this._object.set('left', left);
            this._object.set('top', top);
            this._object.set('width', Math.abs(currentWidth) - this._object.strokeWidth);
            this._object.set('height', Math.abs(currentHeight) - this._object.strokeWidth);
            this._inMove = false;
            this._screenShooter.canvas.renderAll();
            //}
        };

        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._object.set('evented', false);
            this._screenShooter.canvas.renderAll();
            //this._screenShooter.canvas.discardActiveObject();
            //this._screenShooter.canvas.setActiveObject(this._object);
            //this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object.flipX = true;
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            // this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }
}


class NumberedRectanglePlugin extends Plugin {

    _calculateRadius(size, object) {
        let maxRadiusForWidth = 10 * (Math.ceil(size / 6));
        if (!object) return maxRadiusForWidth;
        if (Math.abs(object.get("width") / 4) < maxRadiusForWidth &&  Math.abs(object.get("height") / 4) < maxRadiusForWidth) {
            return (Math.abs(object.get("width"))
            > Math.abs(object.get("height")) ?
                Math.round(Math.abs(object.get("width") / 4)) :
                Math.round(Math.abs(object.get("height") / 4)));
            //return object.get("width")/4;
        }
        return maxRadiusForWidth;
    }

    removeObject(group) {
        //console.log(JSON.stringify(this._objects.keys()));
        if (this._objects.has(group)) {
            this._objects.delete(group);
            super.removeObject(group);
            this.updateIndexes();

        }
    }

    changeObjectColor(group, color) {
        group.item(0).set('stroke', color);
        group.item(1).set('fill', color);
    }

    changeObjectSize(group, size) {
        if (group.item(0).get("width") > 0 && group.item(0).get("height") > 0) {
            let delta = group.item(0).get('strokeWidth') - size;
            group.set('left', group.get('left') + delta);
            group.set('top', group.get('top') + delta);
            group.set('width', group.get('width') - 2 * delta);
            group.set('height', group.get('height') - 2 * delta);
            group.item(0).set('strokeWidth', size);
            this.drawRect(group);
            this.drawCircle(group, this._calculateRadius(size, group.item(0)));
            this.drawNumber(group);
        } else {
            let delta = group.item(1).get('radius') - this._calculateRadius(size, null);
            group.set('left', group.get('left') + delta);
            group.set('top', group.get('top') + delta);
            group.set('width', group.get('width') - 2 * delta);
            group.set('height', group.get('height') - 2 * delta);
            //group.item(0).set('strokeWidth', size);
            //this.drawRect(group);
            this.drawCircle(group, this._calculateRadius(size, null));
            this.drawNumber(group);
        }
    }

    updateIndexes() {
        let i = 1;
        for (let obj of this._objects.keys()) {
            obj.item(2).text = "" + i;
            this.drawNumber(obj);
            i++;
        }
    }

    drawNumber(group) {
        group.item(2).set('fontSize', group.item(1).get('radius') + 3);
        //group.item(2).set('left', (group.item(0).get("width") > 0 ? (group.get('width') - group.item(0).strokeWidth) / 2: 0) - group.item(2).get('width') / 2);
        //group.item(2).set('top', (group.item(0).get("height") > 0 ? (group.get('height') - group.item(0).strokeWidth) / 2: 0) - group.item(2).get('height') / 2);
        if (group.item(0).get("width") > 0 && group.item(0).get("height") > 0) {
            group.item(2).set('left', (group.get('width') - group.item(0).strokeWidth) / 2 - group.item(2).get('width') / 2);
            group.item(2).set('top', (group.get('height') - group.item(0).strokeWidth) / 2 - group.item(2).get('height') / 2);
        } else {
            group.item(2).set('left', - group.item(2).get('width') / 2);
            group.item(2).set('top', - group.item(2).get('height') / 2);
        }
    }

    drawCircle(group, size) {
        group.item(1).set('radius', size);
        if (group.item(0).get("width") > 0 && group.item(0).get("height") > 0){
            group.item(1).set('left',Math.abs((group.get("width") - group.item(0).strokeWidth) / 2) - group.item(1).get('radius'));
            group.item(1).set('top', Math.abs((group.get("height") - group.item(0).strokeWidth) / 2) - group.item(1).get('radius'));
        } else {
            group.item(1).set('left', - group.item(1).get('radius'));
            group.item(1).set('top', - group.item(1).get('radius'));
        }
        //group.item(1).set('left', (group.item(0).get("width") > 0 ? (group.get("width") - group.item(0).strokeWidth) / 2  - group.item(1).get('radius'): group.item(1).get('radius')));
        //group.item(1).set('top', (group.item(0).get("height") > 0 ? (group.get("height") - group.item(0).strokeWidth) / 2  - group.item(1).get('radius'): group.item(1).get('radius')));
    }

    drawRect(group) {
        group.item(0).set('width', group.get("width") - group.item(0).strokeWidth);
        group.item(0).set('height', group.get("height") - group.item(0).strokeWidth);
        group.item(0).set('left', -group.get("width") / 2);
        group.item(0).set('top', -group.get("height") / 2);
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)}, {
            normalClass: "panel-btn ico-rect-number",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this._objects = new Map();
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._clickX = options.e.clientX;
                    this._clickY = options.e.clientY;
                    let obj = new fabric.Group([new fabric.Rect({
                        stroke: this.getColor(),
                        strokeWidth: Number(this.getSize()),
                        fill: 'transparent',
                        //shadow: {color: 'rgba(0,0,0,0.3)', offsetX: 3, offsetY: 3},
                        width: 0,
                        height: 0,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true
                    }), new fabric.Circle({
                        radius: 1,
                        fill: this.getColor(),
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                    }), new fabric.Text("" + (this._objects.size + 1), {
                        fill: '#FFFFFF',
                        shadow: {color: 'rgba(0,0,0,0.7)', offsetX: 1, offsetY: 1},
                        fontSize: 1,
                        fontFamily: 'Arial',
                        id: this._objects.size + 1
                    })], {
                        left: this._clickX,
                        top: this._clickY,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    });


                    this._object = obj;
                    this._screenShooter.canvas.add(obj).setActiveObject(obj);
                    this._objects.set(obj, true);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    this._inMove = false;
                }
                return false;
            } else if (options.target) {

                console.log(options.target);
            }
            console.log(options);
        };


        this.onMouseMove = (options) => {

            //if (!this._inMove) {
            //    this._inMove = true;
            let currentWidth = options.e.clientX - this._clickX;
            let currentHeight = options.e.clientY - this._clickY;
            let left = this._clickX;
            let top = this._clickY;
            if (currentWidth < 0) {
                left = options.e.clientX;
            } else {
                //left = this._clickX - this._object.strokeWidth;
            }

            if (currentHeight < 0) {
                top = options.e.clientY;
            } else {
                //top = this._clickY - this._object.strokeWidth;
            }

            this._object.set('left', left - this._object.item(0).get('strokeWidth'));
            this._object.set('top', top - this._object.item(0).get('strokeWidth'));
            this._object.set('width', Math.abs(currentWidth) + this._object.item(0).get('strokeWidth')*2);
            this._object.set('height', Math.abs(currentHeight)+ this._object.item(0).get('strokeWidth')*2);


            /*this._object.set('width', Math.abs(currentWidth));// + this._object.item(1).get('radius'));
            this._object.set('height', Math.abs(currentHeight));// + this._object.item(1).get('radius'));
            this._object.set('left', left);
            this._object.set('top', top);*/

            /*this._object.item(0).set('width', Math.abs(currentWidth) - this._object.item(0).strokeWidth);
            this._object.item(0).set('height', Math.abs(currentHeight) - this._object.item(0).strokeWidth);
            this._object.item(0).set('left', -(Math.abs(currentWidth)) / 2);
            this._object.item(0).set('top', -(Math.abs(currentHeight)) /2);*/
            this.drawRect(this._object);
            this.drawCircle(this._object, this._calculateRadius(this.getSize(), this._object.item(0)));
            this.drawNumber(this._object);
            //this._object.item(1).set('radius', this._calculateRadius(this. getSize(),this._object.item(0)));
            //this._object.item(1).set('left', (Math.abs(currentWidth) - this._object.item(0).strokeWidth) / 2 - this._object.item(1).get('radius'));
            //this._object.item(1).set('top',  (Math.abs(currentHeight) - this._object.item(0).strokeWidth) / 2 - this._object.item(1).get('radius'));
            //this.setNumberFontSize(this._object, this._calculateRadius(this.getSize(),this._object.item(0))+3);
            //this.positionNumber(this._object);
            //this._object.item(2).set('left', (Math.abs(currentWidth) - this._object.item(0).strokeWidth) / 2 - this._object.item(2).get('width')/2);
            //this._object.item(2).set('top', (Math.abs(currentHeight) - this._object.item(0).strokeWidth) / 2 -  this._object.item(2).get('height')/2);
            //this._object.item(0).set('left', left);
            //this._object.item(0).set('top', top);
            this._inMove = false;
            this._screenShooter.canvas.renderAll();
            //}
        };


        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            if (this._object.item(0).get("width") <= 0 && this._object.item(0).get("height") <= 0){
                this._object.set("left", this._object.get("left") - this.getSize()/2);
                this._object.set("top", this._object.get("top") - this.getSize()/2);
                this.drawCircle(this._object, 10 * (Math.ceil(this.getSize() / 6)));
                this.drawNumber(this._object);
            }
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._object.set('evented', false);
            this._screenShooter.canvas.renderAll();
            //this._screenShooter.canvas.discardActiveObject();
            //this._screenShooter.canvas.setActiveObject(this._object);
            //this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object.item(0).flipX = true;
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            // this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }


    /*
    action() {


        console.log("arrow");
        var poly = new Arrow([0,0,0,0], {
            stroke: 'blue',
            fill: 'red',
            left: 100,
            top: 100
        });
        this._screenShooter.canvas.add(poly);
    }*/


    //d="M20.689,4.25l-6.189,0c-0.414,0 -0.75,-0.336 -0.75,-0.75c0,-0.414 0.336,-0.75 0.75,-0.75l8,0c0.414,0 0.75,0.336 0.75,0.75l0,8c0,0.414 -0.336,0.75 -0.75,0.75c-0.414,0 -0.75,-0.336 -0.75,-0.75l0,-6.189l-17.72,17.719c-0.293,0.293 -0.767,0.293 -1.06,0c-0.293,-0.293 -0.293,-0.767 0,-1.06l17.719,-17.72Z"

}

class RectanglePlugin extends Plugin {


    /*
    * let delta = group.item(0).get('strokeWidth') - size;
        group.set('left',group.get('left') + delta);
        group.set('top',group.get('top') + delta);
        group.set('width',group.get('width') - 2*delta);
        group.set('height',group.get('height') - 2*delta);
        group.item(0).set('strokeWidth', size);
        this.drawRect(group);
        this.drawCircle(group, this._calculateRadius(size, group.item(0)));
        this.drawNumber(group);*/
    changeObjectSize(obj, size) {
        if (obj.plugin === this.constructor.name) {
            let delta = obj.item(0).get('strokeWidth') - size;
            obj.set('left', obj.get('left') + delta);
            obj.set('top', obj.get('top') + delta);
            obj.set('width', obj.get('width') - 2 * delta);
            obj.set('height', obj.get('height') - 2 * delta);
            obj.item(0).set('strokeWidth', size);
            this.drawRect(obj);
        }
    }

    changeObjectColor(obj, color) {
        if (obj.plugin === this.constructor.name) {
            obj.item(0).set('stroke', color);
        }
    }

    drawRect(group) {
        group.item(0).set('width', group.get("width") - group.item(0).strokeWidth);
        group.item(0).set('height', group.get("height") - group.item(0).strokeWidth);
        group.item(0).set('left', -group.get("width") / 2);
        group.item(0).set('top', -group.get("height") / 2);
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)}, {
            normalClass: "panel-btn ico-rect",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._clickX = options.e.clientX;
                    this._clickY = options.e.clientY;
                    this._object = new fabric.Group([new fabric.Rect({
                        stroke: this.getColor(),
                        strokeWidth: Number(this.getSize()),
                        fill: 'transparent',
                        width: 0,
                        height: 0,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: true,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockUniScaling: true
                    })], {
                        left: this._clickX - Number(this.getSize()),
                        top: this._clickY - Number(this.getSize()),
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    });


                    this._screenShooter.canvas.add(this._object).setActiveObject(this._object);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    this._inMove = false;
                }
                return false;
            } else if (options.target) {
                console.log(options.target);
            }
            console.log(options);
        };

        this.onMouseMove = (options) => {

            //if (!this._inMove) {
            //    this._inMove = true;
            let currentWidth = options.e.clientX - this._clickX;
            let currentHeight = options.e.clientY - this._clickY;
            let left = this._clickX;
            let top = this._clickY;
            if (currentWidth < 0) {
                left = options.e.clientX;
            } else {
                //left = this._clickX - this._object.strokeWidth;
            }

            if (currentHeight < 0) {
                top = options.e.clientY;
            } else {
                //top = this._clickY - this._object.strokeWidth;
            }

            this._object.set('left', left - this._object.item(0).get('strokeWidth'));
            this._object.set('top', top - this._object.item(0).get('strokeWidth'));
            this._object.set('width', Math.abs(currentWidth) + this._object.item(0).get('strokeWidth')*2);
            this._object.set('height', Math.abs(currentHeight)+ this._object.item(0).get('strokeWidth')*2);
            this.drawRect(this._object);
            this._inMove = false;
            this._screenShooter.canvas.renderAll();
            //}
        };

        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._object.set('evented', false);
            this._screenShooter.canvas.renderAll();
            //this._screenShooter.canvas.discardActiveObject();
            //this._screenShooter.canvas.setActiveObject(this._object);
            //this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object.item(0).flipX = true;
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            // this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }


    /*
    action() {


        console.log("arrow");
        var poly = new Arrow([0,0,0,0], {
            stroke: 'blue',
            fill: 'red',
            left: 100,
            top: 100
        });
        this._screenShooter.canvas.add(poly);
    }*/


    //d="M20.689,4.25l-6.189,0c-0.414,0 -0.75,-0.336 -0.75,-0.75c0,-0.414 0.336,-0.75 0.75,-0.75l8,0c0.414,0 0.75,0.336 0.75,0.75l0,8c0,0.414 -0.336,0.75 -0.75,0.75c-0.414,0 -0.75,-0.336 -0.75,-0.75l0,-6.189l-17.72,17.719c-0.293,0.293 -0.767,0.293 -1.06,0c-0.293,-0.293 -0.293,-0.767 0,-1.06l17.719,-17.72Z"

}


class CirclePlugin extends Plugin {

    changeObjectSize(obj, size) {
        if (obj.plugin === this.constructor.name) {
            let delta = obj.item(0).get('strokeWidth') - size;
            obj.set('left', obj.get('left') + delta);
            obj.set('top', obj.get('top') + delta);
            obj.set('width', obj.get('width') - 2 * delta);
            obj.set('height', obj.get('height') - 2 * delta);
            obj.item(0).set('strokeWidth', size);
            this.drawCircle(obj);
        }
    }

    changeObjectColor(obj, color) {
        if (obj.plugin === this.constructor.name) {
            obj.item(0).set('stroke', color);
        }
    }

    drawCircle(group) {
        group.item(0).set('rx', (Math.abs(group.get('width') - group.item(0).strokeWidth)) / 2);
        group.item(0).set('ry', (Math.abs(group.get('height') - group.item(0).strokeWidth)) / 2);
        group.item(0).set('left', -group.get("width") / 2);
        group.item(0).set('top', -group.get("height") / 2);
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},  {
            normalClass: "panel-btn ico-circle",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._clickX = options.e.clientX;
                    this._clickY = options.e.clientY;
                    this._object = new fabric.Group([new fabric.Ellipse({
                        stroke: this.getColor(),
                        strokeWidth: Number(this.getSize()),
                        fill: 'transparent',
                        shadow: {color: 'rgba(0,0,0,0.3)', offsetX: 3, offsetY: 3},
                        rx: 0,
                        ry: 0,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    })], {
                        left: this._clickX,
                        top: this._clickY,
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    });

                    this._screenShooter.canvas.add(this._object).setActiveObject(this._object);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    this._inMove = false;
                }
                return false;
            } else if (options.target) {
                console.log(options.target);
            }
            console.log(options);
        };

        this.onMouseMove = (options) => {

            //if (!this._inMove) {
            //    this._inMove = true;
            let currentWidth = options.e.clientX - this._clickX;
            let currentHeight = options.e.clientY - this._clickY;
            let left = this._clickX;
            let top = this._clickY;
            if (currentWidth < 0) {
                left = options.e.clientX;
            } else {
                //left = this._clickX - this._object.strokeWidth;
            }

            if (currentHeight < 0) {
                top = options.e.clientY;
            } else {
                //top = this._clickY - this._object.strokeWidth;
            }

            this._object.set('left', left);
            this._object.set('top', top);
            this._object.set('width', Math.abs(currentWidth));
            this._object.set('height', Math.abs(currentHeight));
            this.drawCircle(this._object);
            this._inMove = false;
            this._screenShooter.canvas.renderAll();
            //}
        };

        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._object.set('evented', false);
            this._screenShooter.canvas.renderAll();
            //this._screenShooter.canvas.discardActiveObject();
            //this._screenShooter.canvas.setActiveObject(this._object);
            //this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object.item(0).flipX = true;
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            // this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }


    /*
    action() {


        console.log("arrow");
        var poly = new Arrow([0,0,0,0], {
            stroke: 'blue',
            fill: 'red',
            left: 100,
            top: 100
        });
        this._screenShooter.canvas.add(poly);
    }*/


    //d="M20.689,4.25l-6.189,0c-0.414,0 -0.75,-0.336 -0.75,-0.75c0,-0.414 0.336,-0.75 0.75,-0.75l8,0c0.414,0 0.75,0.336 0.75,0.75l0,8c0,0.414 -0.336,0.75 -0.75,0.75c-0.414,0 -0.75,-0.336 -0.75,-0.75l0,-6.189l-17.72,17.719c-0.293,0.293 -0.767,0.293 -1.06,0c-0.293,-0.293 -0.293,-0.767 0,-1.06l17.719,-17.72Z"

}


class LinePlugin extends Plugin {

    changeObjectSize(obj, size) {
        if (obj.plugin === this.constructor.name) {
            obj.set('strokeWidth', size);
        }
    }

    changeObjectColor(obj, color) {
        if (obj.plugin === this.constructor.name) {
            obj.set('stroke', color);
        }
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)}, {
            normalClass: "panel-btn ico-line",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._object = null;
        this.onMouseDown = (options) => {
            if (this.isFocused) {
                if (!this._object && this._screenShooter.insideCrop) {
                    this._clickX = options.e.clientX;
                    this._clickY = options.e.clientY;
                    this._object = new fabric.Line([this._clickX, this._clickY, this._clickX, this._clickY], {
                        stroke: this.getColor(),
                        strokeWidth: Number(this.getSize()),
                        selectable: false,
                        hasBorders: false,
                        hasControls: false,
                        objectCaching: false,
                        lockRotation: true,
                        lockSkewingX: true,
                        lockSkewingY: true,
                        plugin: this.constructor.name
                    });
                    this._screenShooter.canvas.add(this._object).setActiveObject(this._object);
                    this._screenShooter.canvas.on('mouse:move', this.onMouseMove);
                    this._screenShooter.canvas.on('mouse:up', this.onMouseUp);
                    this._screenShooter.canvas.renderAll();
                    this._inMove = false;
                }
                return false;
            } else if (options.target) {
                console.log(options.target);
            }
            console.log(options);
        };

        this.onMouseMove = (options) => {

            if (!this._inMove) {
                this._inMove = true;
                this._object.set('x1', options.e.clientX);
                this._object.set('y1', options.e.clientY);
                this._inMove = false;
                this._screenShooter.canvas.renderAll();
            }
            /*
             //if (!this._inMove) {
             //    this._inMove = true;
             let currentWidth = options.e.clientX - this._clickX;
             let currentHeight = options.e.clientY - this._clickY;
             let left = this._clickX;
             let top = this._clickY;
             if (currentWidth < 0) {
                 left = options.e.clientX;
             } else {
                 //left = this._clickX - this._object.strokeWidth;
             }

             if (currentHeight < 0) {
                 top = options.e.clientY;
             } else {
                 //top = this._clickY - this._object.strokeWidth;
             }

             this._object.set('left', left);
             this._object.set('top', top);
             this._object.set('width', Math.abs(currentWidth) - this._object.strokeWidth);
             this._object.set('height', Math.abs(currentHeight) - this._object.strokeWidth);
             this._inMove = false;
             this._screenShooter.canvas.renderAll();
             //}
             */
        };

        this.onMouseUp = (options) => {
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            this._screenShooter.canvas.remove(this._object);
            this._screenShooter.canvas.add(this._object);
            //this._object.set('selectable', true);
            this._object.set('evented', false);
            this._screenShooter.canvas.renderAll();
            //this._screenShooter.canvas.discardActiveObject();
            //this._screenShooter.canvas.setActiveObject(this._object);
            //this._screenShooter.canvas.renderAll();
            /*this._screenShooter.canvas.trigger('event:modified',this._object);
            this._screenShooter.canvas.trigger('event:selected',this._object);
            this._screenShooter.canvas.trigger('event:deselected',this._object);*/
            this._object = null;
        };

    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            this._screenShooter.makeAllUnselectable();
            //this._screenShooter.currentPlugin = this;
            // this._pluginButton.focus();
            this._screenShooter.canvas.on('mouse:down', this.onMouseDown);
        }

    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.off('mouse:down', this.onMouseDown);
            this._screenShooter.canvas.off('mouse:move', this.onMouseMove);
            this._screenShooter.canvas.off('mouse:up', this.onMouseUp);
            //this._screenShooter.currentPlugin = null;
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }


    /*
    action() {


        console.log("arrow");
        var poly = new Arrow([0,0,0,0], {
            stroke: 'blue',
            fill: 'red',
            left: 100,
            top: 100
        });
        this._screenShooter.canvas.add(poly);
    }*/


    //d="M20.689,4.25l-6.189,0c-0.414,0 -0.75,-0.336 -0.75,-0.75c0,-0.414 0.336,-0.75 0.75,-0.75l8,0c0.414,0 0.75,0.336 0.75,0.75l0,8c0,0.414 -0.336,0.75 -0.75,0.75c-0.414,0 -0.75,-0.336 -0.75,-0.75l0,-6.189l-17.72,17.719c-0.293,0.293 -0.767,0.293 -1.06,0c-0.293,-0.293 -0.293,-0.767 0,-1.06l17.719,-17.72Z"

}


class TextPlugin extends Plugin {


    changeObjectSize(obj, size) {
        if (obj.plugin === this.constructor.name) {
            size = 8 + Number(size) * 4;
            //log.info("font size:", size);
            obj.set('fontSize', size);
        }
    }

    changeObjectColor(obj, color) {
        if (obj.plugin === this.constructor.name) {
            obj.set('fill', color);
        }
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},  {
            normalClass: "panel-btn ico-text",
            disabledClass: "panel-btn-disabled",
            focusedClass: "panel-btn-active"
        });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this._arrawIsDrawing = false;
        this._activeArrow = null;
        this.onMouseDown = (options) => {
            if (this._currentITextObject) {
                this._currentITextObject.exitEditing();
                this._screenShooter.canvas.remove(this._currentITextObject);
                this._screenShooter.canvas.add(this._currentITextObject);
                this._screenShooter.canvas.renderAll();
            }
            if (options.target && options.target.get('type') === 'i-text') {
                if (!options.target.isEditing) {
                    this._currentITextObject = options.target;
                    this._screenShooter.canvas.setActiveObject(this._currentITextObject);
                    this._currentITextObject.enterEditing();
                }
            } else if (this._screenShooter.insideCrop) {
                this._currentITextObject = new fabric.IText('', {
                    fontSize: this.getSize() * 4+8,
                    fontFamily: 'Arial',
                    lineHeight: 1,
                    fill: this.getColor(),
                    hadBorders: false,
                    hasRotatingPoint: false,
                    hasControls: false,
                    lockRotation: true,
                    lockSkewingX: true,
                    lockSkewingY: true,
                    //lockMovementX: true,
                    //lockMovementY: true,
                    moveCursor: 'text',
                    //shadow:{ color: 'rgba(0,0,0,0.3)', offsetX: 1, offsetY: 1},
                    left: options.e.clientX,
                    top: options.e.clientY - Math.round((this.getSize() * 4+8)/2),
                    plugin: this.constructor.name
                });
                this._screenShooter.canvas.add(this._currentITextObject).setActiveObject(this._currentITextObject);
                //this._screenShooter.canvas.setActiveObject(this._currentITextObject);
                this._currentITextObject.selectAll();
                this._currentITextObject.enterEditing();
            }
        };
    }


    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            // this._pluginButton.focus();
            //this._screenShooter.currentPlugin = this;
            //this._screenShooter.canvas.setCursor('text');
            this._screenShooter.canvas.hoverCursor = 'text';
            this._screenShooter.makeAllUnselectable();

            this._screenShooter.canvas.getObjects().forEach((obj) => {
                if (obj.type === 'i-text') {
                    obj.set('evented', true);
                    obj.set('selectable', true);
                }
            });

            this._screenShooter.canvas.on('mouse:down',this.onMouseDown);

        }
    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            //this._pluginButton.releaseFocus();
            this._screenShooter.canvas.off('mouse:down',this.onMouseDown);
            if (this._currentITextObject) {
                this._currentITextObject.exitEditing();
                this._screenShooter.canvas.remove(this._currentITextObject);
                this._screenShooter.canvas.add(this._currentITextObject);
                this._currentITextObject = null;
                //Прерываем редактироваение
                //Прерываем редактироваение
            }
            //sthis._screenShooter.canvas.moveCursor = 'move';
            this._screenShooter.canvas.setCursor('default');
            this._screenShooter.canvas.hoverCursor = 'move';
            //this._screenShooter.currentPlugin = null;
            this._screenShooter.makeAllUnselectable();
        }
    }

}

class PencilPlugin extends Plugin {

    /*
     constructor(canvas) {
     super(canvas);
     }*/

    changeObjectSize(obj, size) {
        if (obj.plugin === this.constructor.name) {
            obj.set('strokeWidth',size);
        }
    }

    changeObjectColor(obj, color) {
        if (obj.plugin === this.constructor.name) {
            obj.set('stroke',color);
        }
    }

    _initialize() {
        this._pluginButton = new Button({click: this.focus.bind(this)},
            {
                normalClass: "panel-btn ico-pencil",
                disabledClass: "panel-btn-disabled",
                focusedClass: "panel-btn-active"
            });
        this._screenShooter.panel.addPluginButton(this, this._pluginButton);
        this.onMouseMove = () => {
            if (this._screenShooter.insideCrop){
                this._screenShooter.canvas.isDrawingMode = true;
            } else {
                this._screenShooter.canvas.isDrawingMode = false;
            }
        };

        this.onPathCreated = (obj)=> {
            if (obj.path) {
                obj.path.set('hadBorders', false);
                obj.path.set('hasRotatingPoint', false);
                obj.path.set('hasControls', false);
                obj.path.set('lockRotation', true);
                obj.path.set('lockRotation', true);
                obj.path.set('lockSkewingX', true);
                obj.path.set('lockSkewingY', true);
                obj.path.set('plugin', this.constructor.name);
            }
        }
    }

    focus() {
        if (this.canFocus()) {
            super.focus();
            // if (this._screenShooter.currentPlugin) {
            //     this._screenShooter.currentPlugin.releaseFocus();
            // }
            //this._pluginButton.focus();
            //this._screenShooter.currentPlugin = this;
            this._screenShooter.canvas.freeDrawingBrush.color = this.getColor();
            this._screenShooter.canvas.freeDrawingBrush.width = this.getSize();
            // this._screenShooter.canvas.deactivateAll().renderAll();
            //this._screenShooter.canvas.setCursor('pointer');
            this._screenShooter.makeAllUnselectable();
            this._screenShooter.canvas.on('mouse:move',this.onMouseMove);
            this._screenShooter.canvas.on('path:created',this.onPathCreated);
            //this._pluginButton.focus();
        }
    }

    releaseFocus() {
        if (this === this._screenShooter.currentPlugin) {
            super.releaseFocus();
            this._screenShooter.canvas.isDrawingMode = false;
            this._screenShooter.canvas.off('mouse:move',this.onMouseMove);
            this._screenShooter.canvas.off('path:created',this.onPathCreated);
            //this._screenShooter.currentPlugin = null;
            this._screenShooter.canvas.setCursor('default');
            //this._pluginButton.releaseFocus();
            this._screenShooter.makeAllUnselectable();
        }
    }
}

class DeletePlugin extends Plugin {

    canFocus() {
        return false;
    }

    _initialize() {
        this._deleteButton = new Button({click: this.deleteActiveObject.bind(this)},
            {
                normalClass: "panel-btn ico-delete",
                disabledClass: "panel-btn-disabled",
                focusedClass: "panel-btn-active"
            });
        this._screenShooter.panel.addPluginButton(this, this._deleteButton);

        this.onKeyUp = (e) => {
            if (e.keyCode === 8 || e.keyCode === 46 || ((e.ctrlKey || e.metaKey) && (e.keyCode === 90))) {
                this.deleteActiveObject();
                return false;
            }
        };

        document.addEventListener('keyup', this.onKeyUp);
    }

    deleteActiveObject() {
        if (this._deleteButton.isEnabled()) {
            let activeObjects = this._screenShooter.canvas.getActiveObjects();
            //activeGroup = this._screenShooter.canvas.getActiveGroup();
            let objects = this._screenShooter.canvas.getObjects();
            if (!activeObjects.length && objects.length > 0) {
                this._screenShooter.canvas.setActiveObject(objects[objects.length - 1]);
            }
            activeObjects = this._screenShooter.canvas.getActiveObjects();
            if (activeObjects.length > 0) {
                /*if (confirm(activeObjects.length>1?'Вы уверены, что хотите удалить объект':'Вы уверены что хотите удалить объект')) {
                    //this._screenShooter.canvas.remove(activeObjects);
                    /*let activeSelection = new fabric.ActiveSelection();
                    console.log(activeSelection);*/
                //this._screenShooter.canvas.remove(activeSelection);
                /*activeObjects.forEach((obj)=>{
                    obj.
                    this._screenShooter.canvas.remove(obj).renderAll();
                });*/
                if ((activeObjects.length === 1 && activeObjects[0].type === 'i-text' && activeObjects[0].isEditing) || activeObjects[0].type === 'cropZone') {
                    return true;
                }

                activeObjects.forEach((obj) => {
                    if (obj.plugin) {
                        if (this.getOtherPlugin(obj.plugin)) {
                            this.getOtherPlugin(obj.plugin).removeObject(obj);
                        }
                    }
                    /*if (obj.type === 'group'){
                        if (obj.plugin){
                            obj.plugin.removeObject(obj);
                        }
                    }
                    this._screenShooter.canvas.remove(obj).renderAll();*/
                });
                this._screenShooter.canvas.discardActiveObject();
                this._screenShooter.canvas.renderAll();
                return false;
                //}
            }
            /*
            else if (activeGroup) {
                if (confirm('Вы уверены, что хотите удалить группу объектов')) {
                    var objectsInGroup = activeGroup.getObjects();
                    this._screenShooter.canvas.discardActiveGroup();
                    objectsInGroup.forEach((object) => {
                        this._screenShooter.canvas.remove(object);
                    });
                }
            }*/
        }
        return true;
    }
}

class ClipboardSavePlugin extends Plugin {

    canFocus() {
        return false;
    }

    _initialize() {
        this._button = new Button({click: this.saveImageToClipboard.bind(this)},
            {
                normalClass: "",
                disabledClass: "",
                focusedClass: ""
            }, '.ico-clipboard');
        this._screenShooter.panel.addPluginButton(this, this._button);
        this.onKeyUp = (e) => {
            if (e.keyCode === 67 && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                this.saveImageToClipboard();
                return false;
            }
        };
        document.addEventListener('keydown', this.onKeyUp);
    }

    saveImageToClipboard() {
        this._screenShooter.saving = true;
        let dims = this._screenShooter.getCropDims();
        let dataUrl = this._screenShooter.canvas.toDataURL(dims);
        ipcRenderer.send('saveDataURLToClipboard', dataUrl);
        ipcRenderer.send("notification", {
            title: "Скриншот скопирован с буффер",
            body: "Скриншот скопирован с буффер"
        });
        if (conf.get('autoSave')){
            const fs = require('fs-extra');
            let fileName = this._screenShooter.getFileName();
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            fs.outputFile(fileName, Buffer.from(base64Data, 'base64')).then(
                () => {
                    this._screenShooter.getDb().history.put({
                        date: new Date(),
                        file: fileName,
                        width: dims.width,
                        height: dims.height
                    }).then(()=>{
                        ipcRenderer.send("history-updated", {});
                    });
                    ipcRenderer.send('history-updated',{});
                    this._screenShooter.doShutdown();
                }
            ).catch( err =>{
                ipcRenderer.send("show-error-box", {
                    title: "Ошибка сохранения файла в историю",
                    message: err
                });
                this._screenShooter.doShutdown();
            });
        } else {
            this._screenShooter.doShutdown();
        }
    }
}


class DiskSavePlugin extends Plugin {

    canFocus() {
        return false;
    }

    _initialize() {
        this._button = new Button({click: this.saveFileToDisk.bind(this)},
            {
                normalClass: "",
                disabledClass: "",
                focusedClass: ""
            }, '.ico-local');
        this._screenShooter.panel.addPluginButton(this, this._button);
        this.onKeyUp = (e) => {
            if (e.keyCode === 13 && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                this.saveFileToDisk();
                return false;
            }
        };
        document.addEventListener('keydown', this.onKeyUp);
    }

    saveFileToDisk() {
        this._screenShooter.saving = true;
        let dims = this._screenShooter.getCropDims();
        let dataUrl = this._screenShooter.canvas.toDataURL(dims);
        const fs = require('fs-extra');
        let fileName = this._screenShooter.getFileName();
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.outputFile(fileName, Buffer.from(base64Data, 'base64')).then(
            () => {
                this._screenShooter.getDb().history.put({
                    date: new Date(),
                    file: fileName,
                    width: dims.width,
                    height: dims.height
                }).then(()=>{
                    ipcRenderer.send("history-updated", {});
                });
                ipcRenderer.send('history-updated',{});
                ipcRenderer.send("notification", {
                    title: "Скриншот сохранен на диск",
                    body: "Нажмите, чтобы показать в папке",
                    file: fileName
                });
                this._screenShooter.doShutdown();
            }
        ).catch( err =>{
            ipcRenderer.send("show-error-box", {
                title: "Ошибка сохранения файла",
                message: err
            });
        });
    }
}


class CloudSavePlugin extends Plugin {

    canFocus() {
        return false;
    }

    _initialize() {
        this._uploadButton = new Button({click: this.uploadImageToServer.bind(this)},
            {
                normalClass: "",
                disabledClass: "",
                focusedClass: ""
            }, '.ico-cloud');

        this._screenShooter.panel.addPluginButton(this, this._uploadButton);
        this.onKeyUp = (e) => {
            //console.log(e.keyCode);
            if (e.keyCode === 13 && (e.metaKey || e.ctrlKey)) {
                this.uploadImageToServer();
                return false;
            }
        };

        document.addEventListener('keydown', this.onKeyUp);
    }

    urlToFile(url, filename, mimeType) {
        return (fetch(url)
                .then(function (res) {
                    return res.arrayBuffer();
                })
                .then(function (buf) {
                    return new File([buf], filename, {type: mimeType});
                })
        );
    }

    uploadImageToServer() {
        if (this._uploadButton.isEnabled()) {
            this._screenShooter.saving = true;
            ipcRenderer.send('writeTextToClipboard', "Скриншот еще не залился на сервер, торопиться не надо!");
            let dims = this._screenShooter.getCropDims();
            let dataUrl = this._screenShooter.canvas.toDataURL(dims);
            
            let arr = dataUrl.split(','), mime = (arr[0].match(/:(.*?);/) || ['', 'image/png'])[1],
                bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            let res = new File([u8arr], "my.png", {type: mime});
            
            let xhr = new XMLHttpRequest();
            let backend = conf.get('backend');
            let authenticated = conf.get('authenticated');
            let plugin = this;
            if (authenticated) {
                let token = conf.get('token');
                xhr.open("POST", backend + "/upload", true);
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                let formData = new FormData();
                formData.append('width', dims.width);
                formData.append('height', dims.height);
                formData.append('image', res);
                xhr.onload = function (e) {
                    if (this.status === 200) {
                        try {
                            let resp = JSON.parse(this.response);
                            if (resp && resp.status) {
                                if (resp.status === 'ok') {
                                    let fullUrl = backend + "/" + resp.url;
                                    ipcRenderer.send('writeTextToClipboard', fullUrl);
                                    if (conf.get('openInBrowser')) {
                                        ipcRenderer.send('open-external', fullUrl);
                                        ipcRenderer.send("notification", {
                                            title: "Скриншот создан",
                                            body: "Ссылка в буфере обмена.",
                                        });
                                    } else {
                                        ipcRenderer.send("notification", {
                                            title: "Скриншот создан",
                                            body: "Ссылка скопирована в буфер: " + fullUrl,
                                            url: fullUrl
                                        });
                                    }

                                    plugin._screenShooter.getDb().history.add({
                                        date: new Date(),
                                        url: resp.url,
                                        image_url: resp.image_url,
                                        width: formData.get('width'),
                                        height: formData.get('height')
                                    }).then((id)=>{
                                        if (conf.get('autoSave')){
                                            const fs = require('fs-extra');
                                            let fileName = plugin._screenShooter.getFileName();
                                            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                                            fs.outputFile(fileName, Buffer.from(base64Data, 'base64')).then(()=>{
                                                plugin._screenShooter.getDb().history.update(id,{
                                                    file: fileName
                                                }).then(()=>{
                                                    ipcRenderer.send("history-updated", {});
                                                }).catch(()=>{});
                                                plugin._screenShooter.doShutdown();
                                            }).catch(err => {
                                                ipcRenderer.send("show-error-box", {
                                                    title: "Ошибка сохранения файла в историю",
                                                    message: String(err)
                                                });
                                                plugin._screenShooter.doShutdown();
                                            });
                                        } else {
                                            ipcRenderer.send("history-updated", {});
                                            plugin._screenShooter.doShutdown();
                                        }
                                    }).catch((error)=>{
                                        log.error("Error writing history record", error);
                                        plugin._screenShooter.doShutdown();
                                    });
                                } else if (resp.status === 'error') {
                                    if (resp.message === "not authorized") {
                                        ipcRenderer.send("authorization-not-valid");
                                    } else {
                                        ipcRenderer.send("show-error-box", {
                                            title: "Произошла ошибка на сервере",
                                            message: resp.message
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(e);
                            console.log(this.response);
                        }
                    } else {
                        console.log("Код ответа: " + this.status);
                        ipcRenderer.send("show-error-box", {
                            title: "Произошла ошибка на сервере",
                            message: "Код ответа: " + this.status + " Ответ: " + this.response
                        });
                    }
                };
                xhr.onerror = function(err) {
                    log.error("XHR error uploading image", err);
                    ipcRenderer.send("show-error-box", {
                        title: "Ошибка сети при загрузке",
                        message: "Не удалось соединиться с сервером " + backend
                    });
                };
                xhr.send(formData);
            } else {
                ipcRenderer.send("do-authenticate", {});
            }
        }
        return true;
    }

}

class ScreenShooter {

    getFileName(){
        let date = new Date();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        if (month < 10) month = "0" + month;
        if (day < 10) day = "0" + day;
        let hours = date.getHours();
        if (hours < 10) hours = "0" + hours;
        let minutes = date.getMinutes();
        if (minutes < 10) minutes = "0" + minutes;
        let seconds = date.getSeconds();
        if (seconds < 10) seconds = "0" + seconds;
        let fileName = "/Screen_" + date.getFullYear() + month + day + "_" + hours + minutes + seconds + ".png";
        let path = conf.get('saveDir');
        if (conf.get('autoSave')) {
            path += "/"+date.getFullYear()+month+day;
        }
        return path + fileName;
    }

   /* saveScreenToDisk(dataUrl, callback) {
        const nativeImage = require('electron').nativeImage;
        let img = nativeImage.createFromDataURL(dataUrl);
        const fs = require('fs-extra');
        fs.outputFile(path,img.toPng(),callback);
    }*/

    getCropDims() {
        if (this.fullscreen) {
            return {
                left: 0,
                top: 0,
                width: this.canvas.get('width'),
                height: this.canvas.get('height'),
                multiplier: this.maxScaleFactor
            }
        } else {
            return {
                left: this.cropZone.get('left'),
                top: this.cropZone.get('top'),
                width: this.cropZone.get('width'),
                height: this.cropZone.get('height'),
                multiplier: this.maxScaleFactor
            }
        }
    }

    getDb() {
        if (!this.db) {
            let {db} = require('./storage');
            this.db = db;
        }
        return this.db;
    }

    registerPlugin(plugin) {
        this.pluginsByClassName.set(plugin.constructor.name, plugin);
    }

    getPlugin(plugin) {
        if (plugin instanceof Plugin) {
            return this.pluginsByClassName.get(plugin.constructor.name);
        } else {
            return this.pluginsByClassName.get(plugin);
        }
    }

    constructor(selector, colorSelector, sizeSelector, [сapturer, ipc, screen], options = {}, plugins = {}) {
        this.desktopCapturer = сapturer;
        this.ipcRenderer = ipc;
        this.screen = screen;
        this.db = null;
        this.selector = selector;
        this.currentPlugin = null;
        this.cropZone = null;
        this.mode = 'crop';
        this.insideCrop = false;
        this.minCropSize = 5;
        this.cropX1 = 0;
        this.cropY1 = 0;
        this.cropX2 = 0;
        this.cropY2 = 0;
        this.changing = false;
        this.fullscreen = false;
        this.lastWheelTimestamp = null;
        this.wheelInAction = false;
        this.shutdown = false;
        this._bindIPC();
        this.pluginsByClassName = new Map();
        this.saving = false;

        ipcRenderer.on('destroy', () => {
            if (!this.saving) {
                this.doShutdown();
            }
        });

        this.onMultiSelectionCreated = (e) => {
            e.target.set(
                {
                    hadBorders: false,
                    hasRotatingPoint: false,
                    hasControls: false,
                    lockRotation: true,
                    lockSkewingX: true,
                    lockSkewingY: true
                });
        };

        this.doShutdown = () => {
            if (!this.shutdown) {
                this.shutdown = true;
                if (this.currentPlugin){
                    this.currentPlugin.releaseFocus();
                }
                ipcRenderer.send("destroy-main-window", {});
            }
        };
        this.onKeyUp = (e) => {
            if (!this.shutdown) {
                if (e.keyCode === 27) {
                    this.doShutdown();
                } else if (this.mode === 'crop') {
                    if (e.keyCode === 13) {
                        this.canvas.off('mouse:move', this.topCropConnerMove);
                        this.canvas.off('mouse:down', this.cropMouseDown);
                        this.canvas.off('mouse:move', this.bottomCropConnerMove);
                        this.canvas.off('mouse:up', this.cropMouseUp);
                        this.cropZone.set('left', Math.round(this.display.size.width * 0.25));
                        this.cropZone.set('top', Math.round(this.display.size.height * 0.25));
                        this.cropZone.set('width', Math.round(this.display.size.width * 0.5));
                        this.cropZone.set('height', Math.round(this.display.size.height * 0.5));
                        this.toggleFullScreen();
                        this.firstCropDone();
                        this.mode = 'normal';
                        this.cropX1 = this.cropZone.get('left');
                        this.cropY1 = this.cropZone.get('top');
                        this.cropX2 = this.cropX1 + this.cropZone.get('width');
                        this.cropY2 = this.cropY1 + this.cropZone.get('height');
                    } else if (e.keyCode === 32 && this.restoreCropSize()) {
                        this.canvas.off('mouse:move', this.topCropConnerMove);
                        this.canvas.off('mouse:down', this.cropMouseDown);
                        this.canvas.off('mouse:move', this.bottomCropConnerMove);
                        this.canvas.off('mouse:up', this.cropMouseUp);
                        this.canvas.renderAll();
                        this.firstCropDone();
                        this.mode = 'normal';
                        this.cropX1 = this.cropZone.get('left');
                        this.cropY1 = this.cropZone.get('top');
                        this.cropX2 = this.cropX1 + this.cropZone.get('width');
                        this.cropY2 = this.cropY1 + this.cropZone.get('height');
                    }

                }
            }
        };

        document.onkeyup = this.onKeyUp;

        this.onWheel = (e) => {
            if (this.mode === 'normal' && !this.shutdown) {
                if (!this.wheelInAction) {
                    this.wheelInAction = true;
                    if (this.lastWheelTimestamp !== null) {
                        if (e.timeStamp - this.lastWheelTimestamp > 70) {

                            /*let delta = this.lastWheelValue - e.deltaY;
                            console.log(e.deltaY, delta);*/

                            //if (Math.abs(delta) > 10) {
                            let value = Number(this.sizeInput.value);
                            if (e.deltaY < 0) {
                                value = Number(this.sizeInput.value) - 1;
                            } else if (e.deltaY > 0) {
                                value = Number(this.sizeInput.value) + 1;
                            }

                            if (value < 1) {
                                value = 1;
                            }

                            if (value > 20) {
                                value = 20;
                            }

                            if (value !== Number(this.sizeInput.value)) {
                                this.sizeInput.value = value;
                                this.onSizeChanged({});
                            }
                            this.lastWheelTimestamp = e.timeStamp;
                        }

                    } else {
                        this.lastWheelTimestamp = e.timeStamp;
                    }
                    this.wheelInAction = false;
                }
            }
        };

        document.onwheel = this.onWheel;

        this.onColorChanged = (e) => {
            if (!this.shutdown) {
                this.currentPlugin.setColor(this.colorInput.value);
                if (this.currentPlugin instanceof PencilPlugin) {
                    this.canvas.freeDrawingBrush.color = this.currentPlugin.getColor();
                } else if (this.currentPlugin instanceof SelectPlugin) {
                    if (this.canvas.getActiveObjects()) {
                        this.canvas.getActiveObjects().forEach((obj) => {
                            let color = this.colorInput.value;
                            if (obj.plugin) {
                                this.getPlugin(obj.plugin).changeObjectColor(obj, color);
                            }
                            /*
                            switch (obj.type) {
                                case 'rect':
                                case 'line':
                                case 'ellipse':
                                case 'circle':
                                case 'path':
                                    obj.set('stroke', color);
                                    break;
                                case 'group':
                                    if (obj.plugin) {
                                        obj.plugin.changeColorOfSelectedObject(obj, color);
                                    }
                                    break;
                                default:
                                    obj.set('fill', this.colorInput.value);
                            }
                            //console.log(obj.type);*/
                        });
                    }
                } else if (this.currentPlugin instanceof TextPlugin && this.currentPlugin._currentITextObject.isEditing) {
                    this.currentPlugin._currentITextObject.set('fill', this.colorInput.value);
                    this.canvas.setActiveObject(this.currentPlugin._currentITextObject);
                    this.currentPlugin._currentITextObject.exitEditing();
                    this.currentPlugin._currentITextObject.enterEditing();
                }
                this.canvas.renderAll();
            }
        };

        this.onSizeChanged = (e) => {
            if (!this.shutdown) {
                this.currentPlugin.setSize(this.sizeInput.value);
                if (this.currentPlugin instanceof PencilPlugin) {
                    this.canvas.freeDrawingBrush.width = this.currentPlugin.getSize();
                } else {
                    if (this.canvas.getActiveObjects()) {
                        this.canvas.getActiveObjects().forEach((obj) => {
                            if (obj.plugin) {
                                this.getPlugin(obj.plugin).changeObjectSize(obj, Math.round(Number(this.sizeInput.value)));
                            }
                            /*
                            switch (obj.type) {
                                case 'i-text':
                                    obj.set('fontSize', this.sizeInput.value * 5);
                                    if (obj.isEditing) {
                                        obj.exitEditing();
                                        obj.enterEditing();
                                    }
                                    break;
                                case 'line':
                                case 'ellipse':
                                case 'circle':
                                case 'rect':
                                    obj.set('strokeWidth', Number(this.sizeInput.value));
                                    break;
                                case 'arrow':
                                    obj.set('weight', Number(this.sizeInput.value) / 3);
                                    break;
                                case 'path':
                                    obj.set('strokeWidth', Number(this.sizeInput.value));
                                    break;

                                case 'group':
                                    if (obj.plugin) {
                                        obj.plugin.changeSizeOfSelectedObject(obj, Number(this.sizeInput.value));
                                    }
                                    break;

                            }*/

                        });
                        this.canvas.renderAll();
                    }
                }
            }

        };

        this.topCropConnerMove = (options) => {
            //if (!this.changing) {
            //  this.changing = true;
            this.cropX1 = options.e.clientX;
            this.cropY1 = options.e.clientY;
            this.cropZone.set('left', options.e.clientX);
            this.cropZone.set('top', options.e.clientY);
            this.canvas.renderAll();
            //this.changing = false;
            //}
        };

        this.cropMouseDown = (options) => {
            this.canvas.off('mouse:move', this.topCropConnerMove);
            this.canvas.off('mouse:down', this.cropMouseDown);
            this.canvas.on('mouse:move', this.bottomCropConnerMove);
            this.canvas.on('mouse:up', this.cropMouseUp);
        };

        this.bottomCropConnerMove = (options) => {
            //if (!this.changing) {
            //  this.changing = true;
            let left = this.cropX1;
            let top = this.cropY1;
            let width = options.e.clientX - this.cropX1;
            let height = options.e.clientY - this.cropY1;
            if (width < 0) {
                left = options.e.clientX;
            }
            if (height < 0) {
                top = options.e.clientY;
            }
            this.cropZone.set('left', left);
            this.cropZone.set('top', top);
            this.cropZone.set('width', Math.abs(width));
            this.cropZone.set('height', Math.abs(height));
            this.canvas.renderAll();
            // this.changing = false;
            //}
        };

        this.cropMouseUp = (options) => {
            this.canvas.off('mouse:move', this.bottomCropConnerMove);
            this.canvas.off('mouse:up', this.cropMouseUp);
            if (Math.abs(options.e.clientX - this.cropX1) < this.minCropSize || Math.abs(options.e.clientY - this.cropY1) < this.minCropSize) {
                this.cropZone.set('width', 1);
                this.cropZone.set('height', 1);
                this.canvas.on('mouse:move', this.topCropConnerMove);
                this.canvas.on('mouse:down', this.cropMouseDown);
            } else {
                this.firstCropDone();
                this.mode = 'normal';
                this.cropX1 = this.cropZone.get('left');
                this.cropY1 = this.cropZone.get('top');
                this.cropX2 = this.cropX1 + this.cropZone.get('width');
                this.cropY2 = this.cropY1 + this.cropZone.get('height');
            }
        };

        this.firstCropDone = () => {
            this.panel = new Panel('#buttons-panel', this);
            this.colorInput = document.querySelector(colorSelector);
            this.sizeInput = document.querySelector(sizeSelector);
            document.getElementById("crop-help").style.display = 'none';
            if (conf.get('color')) {
                this.colorInput.value = conf.get('color');
            }
            if (conf.get('size')) {
                this.sizeInput.value = conf.get('size');
            }

            this.saveCropSize();

            this.colorInput.onchange = this.onColorChanged;
            this.sizeInput.onchange = this.onSizeChanged;
            this.canvas.defaultCursor = 'default';
            this.canvas.on('mouse:move', this.resizeMouseMove);
            this.canvas.on('mouse:down', this.resizeMouseDown);
            this.registerPlugin(new RectanglePlugin(this));
            this.registerPlugin(new ArrowPlugin(this));
            this.registerPlugin(new TextPlugin(this));
            this.registerPlugin(new LinePlugin(this));
            this.registerPlugin(new CirclePlugin(this));
            this.registerPlugin(new NumberedRectanglePlugin(this));
            this.registerPlugin(new BlurPlugin(this));
            this.registerPlugin(new PencilPlugin(this));
            this.registerPlugin(new SelectPlugin(this));
            this.registerPlugin(new ExpandPlugin(this));
            this.registerPlugin(new DeletePlugin(this));
            this.registerPlugin(new ClipboardSavePlugin(this));
            this.registerPlugin(new DiskSavePlugin(this));
            this.registerPlugin(new CloudSavePlugin(this));
            this.getPlugin(RectanglePlugin.name).focus();
        };

        this.saveCropSize = () => {
            if (!this.fullscreen) {
                conf.set('last_crop_left_'+this.display.size.width+"X"+this.display.size.height, this.cropZone.get('left'));
                conf.set('last_crop_top_'+this.display.size.width+"X"+this.display.size.height, this.cropZone.get('top'));
                conf.set('last_crop_width_'+this.display.size.width+"X"+this.display.size.height, this.cropZone.get('width'));
                conf.set('last_crop_height_'+this.display.size.width+"X"+this.display.size.height, this.cropZone.get('height'));
            }
        };

        this.restoreCropSize = () => {
            if (!this.display || !this.display.size) {
                return false;
            }
            let _left = conf.get('last_crop_left_'+this.display.size.width+"X"+this.display.size.height, false);
            let _top = conf.get('last_crop_top_'+this.display.size.width+"X"+this.display.size.height, false);
            let _width = conf.get('last_crop_width_'+this.display.size.width+"X"+this.display.size.height, false);
            let _height = conf.get('last_crop_height_'+this.display.size.width+"X"+this.display.size.height, false);

            if (_left && _top && _height && _width) {
                this.cropZone.set('left', Number(_left));
                this.cropZone.set('top', Number(_top));
                this.cropZone.set('height',Number(_height));
                this.cropZone.set('width', Number(_width));
                return true;
            }
            return false;
        };


        this.resizeMouseDown = (options) => {
            if (!this.insideCrop) {
                this.mode = 'resize';
                this.canvas.off('mouse:down', this.resizeMouseDown);
                this.resizeClickX = options.e.clientX;
                this.resizeClickY = options.e.clientY;
                this.resizeTop = this.cropZone.get('top');
                this.resizeLeft = this.cropZone.get('left');
                this.resizeWidth = this.cropZone.get('width');
                this.resizeHeight = this.cropZone.get('height');
                this.clickResizeMode = this.resizeMode;
                this.canvas.on('mouse:up', this.resizeMouseUp);
            }
        };

        this.resizeMouseUp = (options) => {
            this.saveCropSize();
            this.mode = 'normal';
            this.canvas.off('mouse:up', this.resizeMouseUp);
            this.canvas.on('mouse:down', this.resizeMouseDown);
        };

        this.resizeMouseMove = (options) => {
            let x = options.e.clientX;
            let y = options.e.clientY;
            this.insideCrop = false;
            let cursor = 'default';

            if (x >= this.cropX1 && x <= this.cropX2 && y >= this.cropY1 && y <= this.cropY2 || this.fullscreen) {
                this.insideCrop = true;
                this.resizeMode = 'none';
            } else if (x >= this.cropX1 && x <= this.cropX2) {
                if (y < this.cropY1) {
                    this.resizeMode = 'top';
                } else {
                    this.resizeMode = 'bottom';
                }
                cursor = 'ns-resize';
            } else if (y >= this.cropY1 && y <= this.cropY2) {
                if (x < this.cropX1) {
                    this.resizeMode = 'left';
                } else {
                    this.resizeMode = 'right'
                }
                cursor = 'ew-resize';
            } else if (x < this.cropX1) {
                if (y < this.cropY1) {
                    this.resizeMode = 'top-left';
                    cursor = 'nwse-resize';
                } else {
                    this.resizeMode = 'bottom-left'
                    cursor = 'nesw-resize';
                }
            } else {
                if (y < this.cropY1) {
                    this.resizeMode = 'top-right';
                    cursor = 'nesw-resize';
                } else {
                    this.resizeMode = 'bottom-right';
                    cursor = 'nwse-resize';
                }
            }

            // if (!this.changing) {

            //this.changing = true;

            if (!this.insideCrop) {
                this.canvas.defaultCursor = cursor;
            } else {
                this.canvas.defaultCursor = 'default';
            }

            if (!this.resizes) {
                this.resizes = {
                    'top': (options) => {
                        if ((this.resizeHeight + (this.resizeClickY - options.e.clientY) > this.minCropSize) || (options.e.shiftKey)) {

                            if (this.resizeTop - (this.resizeClickY - options.e.clientY) <= 1) {
                                return;
                            }
                            if (this.resizeTop - (this.resizeClickY - options.e.clientY) + this.cropZone.get('height') >= this.display.size.height - 1) {
                                return;
                            }

                            this.cropZone.set('top', this.resizeTop - (this.resizeClickY - options.e.clientY));
                            if (!options.e.shiftKey) {
                                this.cropZone.set('height', this.resizeHeight + (this.resizeClickY - options.e.clientY));
                            } else {
                                this.cropY2 = this.resizeTop + this.resizeHeight - (this.resizeClickY - options.e.clientY);
                            }
                            this.cropY1 = this.resizeTop - (this.resizeClickY - options.e.clientY);
                        }
                    },
                    'bottom': (options) => {
                        if (this.resizeHeight - (this.resizeClickY - options.e.clientY) > this.minCropSize || (options.e.shiftKey)) {

                            if (this.resizeTop - (this.resizeClickY - options.e.clientY) <= 1) {
                                return;
                            }
                            if (this.resizeTop - (this.resizeClickY - options.e.clientY) + this.cropZone.get('height') >= this.display.size.height - 1) {
                                return;
                            }

                            if (!options.e.shiftKey) {
                                this.cropZone.set('height', this.resizeHeight - (this.resizeClickY - options.e.clientY));
                            } else {
                                this.cropZone.set('top', this.resizeTop - (this.resizeClickY - options.e.clientY));
                                this.cropY1 = this.resizeTop - (this.resizeClickY - options.e.clientY);
                            }
                            this.cropY2 = this.resizeTop + this.resizeHeight - (this.resizeClickY - options.e.clientY);
                            //this.cropZone.set('top', this.resizeTop + (this.resizeClickY - options.e.clientY));
                        }
                    },
                    'right': (options) => {
                        if (this.resizeWidth - (this.resizeClickX - options.e.clientX) > this.minCropSize ||
                            (options.e.shiftKey)) {

                            if (this.resizeLeft - (this.resizeClickX - options.e.clientX) <= 1) {
                                return;
                            }
                            if (this.resizeLeft - (this.resizeClickX - options.e.clientX) + this.cropZone.get('width') >= this.display.size.width - 1) {
                                return;
                            }

                            if (!options.e.shiftKey) {
                                this.cropZone.set('width', this.resizeWidth - (this.resizeClickX - options.e.clientX));
                            } else {
                                this.cropZone.set('left', this.resizeLeft - (this.resizeClickX - options.e.clientX));
                                this.cropX1 = this.resizeLeft - (this.resizeClickX - options.e.clientX);
                            }
                            this.cropX2 = this.resizeLeft + this.resizeWidth - (this.resizeClickX - options.e.clientX);
                            //this.cropZone.set('top', this.resizeTop + (this.resizeClickY - options.e.clientY));
                        }
                    },
                    'left': (options) => {
                        if (this.resizeWidth + (this.resizeClickX - options.e.clientX) > this.minCropSize ||
                            (options.e.shiftKey)) {

                            if (this.resizeLeft - (this.resizeClickX - options.e.clientX) <= 1) {
                                return;
                            }
                            if (this.resizeLeft - (this.resizeClickX - options.e.clientX) + this.cropZone.get('width') >= this.display.size.width - 1) {
                                return;
                            }

                            this.cropZone.set('left', this.resizeLeft - (this.resizeClickX - options.e.clientX));
                            if (!options.e.shiftKey) {
                                this.cropZone.set('width', this.resizeWidth + (this.resizeClickX - options.e.clientX));
                            } else {
                                this.cropX2 = this.resizeLeft + this.resizeWidth - (this.resizeClickX - options.e.clientX);
                            }
                            this.cropX1 = this.resizeLeft - (this.resizeClickX - options.e.clientX);
                        }
                    }
                }

            }

            switch (this.mode) {
                case 'normal':
                    break;
                case 'resize':
                    //if (this.resizeMode === this.clickResizeMode) {
                    this.clickResizeMode.split('-').forEach((obj) => {
                        this.resizes[obj](options);
                    });
                    this.canvas.renderAll();
                    //}
                    break;
            }
            //this.changing = false;
        }

    }

    updateAllObjects(property, value) {
        this.canvas.getObjects().forEach((obj) => {
            if (obj !== this.cropZone) {
                obj.set(property, value);
            }
        });
    }

    makeAllUnselectable() {
        this.updateAllObjects('selectable', false);
        this.updateAllObjects('hasBorders', false);
        this.updateAllObjects('evented', false);
        this.canvas.set('selection', false);
        this.canvas.off('selection:created', this.onMultiSelectionCreated)
        this.canvas.off('selection:cleared', this.canvas.renderAll);
    }

    makeAllSelectable() {
        this.updateAllObjects('selectable', true);
        this.updateAllObjects('hasBorders', true);
        this.updateAllObjects('evented', true);
        this.canvas.set('selection', true);
        this.canvas.on('selection:created', this.onMultiSelectionCreated)
        this.canvas.on('selection:cleared', this.canvas.renderAll);
    }

    toggleFullScreen() {
        if (this.cropZone.get('visible')) {
            this.cropZone.set('visible', false);
            this.fullscreen = true;
            this.canvas.renderAll();
        } else {
            this.cropZone.set('visible', true);
            this.fullscreen = false;
            this.canvas.renderAll();
        }
    }


    _bindIPC() {
        this.cursor = {x: 0, y: 0};

        ipcRenderer.on('shoot-screen', (event, display) => {
            this.cursor = display.cursor || this.cursor;
            /*console.log(display);
            let disp = this.screen.getAllDisplays().find((display)=>{
                return display.id === displayId;
            });*/
            this._newScreenShot(display);
        });

        ipcRenderer.on('screen-from-file', (event, opts)=>{
            this.display = opts.display;
            this.cursor = opts.cursor || this.cursor;
            this.maxScaleFactor = this.display.scaleFactor;
            this._applyBase64Shot2(opts.file);
        });
    }

    _newScreenShot(display) {
        this.display = display;
        this.maxScaleFactor = display.scaleFactor;
        StopWatch.start('thumbscapture');
        capture(display, conf.get('saveDir')).then((file) => {
            log.info(StopWatch.end('thumbscapture').toString());
            this._applyBase64Shot2(pathToFileURL(file).href);
        }).catch((err) => {
            log.error(StopWatch.end('thumbscapture').toString());
            log.error(err);
            ipcRenderer.send('show-error-box', {
                title: 'Не удалось сделать снимок экрана',
                message: (err && err.message) ? err.message : String(err)
            });
        });
    }

    // Электрон отдаёт позицию курсора только в главном процессе,
    // поэтому main.js передаёт её вместе с дисплеем
    getCursorPoint() {
        return this.cursor || {x: 0, y: 0};
    }

    _applyBase64Shot2(dataUrl) {
        let canvasEl = document.querySelector(this.selector);
        canvasEl.setAttribute("width", this.display.size.width + "px");
        canvasEl.setAttribute("height", this.display.size.height + "px");

        this.canvas = new fabric.Canvas(canvasEl, {
            selection: false
        });

        fabric.Image.fromURL(dataUrl, (im) => {

            log.info("real thumb width: ", im.get('width'));
            log.info("real thumb height: ", im.get('height'));

            //если пришел скрин всех рабочих столов
            if (this.display.size.width * this.display.scaleFactor < im.get('width') || this.display.size.height * this.display.scaleFactor < im.get('height')) {
                im.set('cropX', this.display.bounds.x * this.maxScaleFactor);
                im.set('cropY', this.display.bounds.y * this.maxScaleFactor);
            }

            im.set('width', this.display.size.width * this.maxScaleFactor);
            im.set('height', this.display.size.height * this.maxScaleFactor);
            if (this.display.scaleFactor !== 1) {
                im.scale(1 / this.maxScaleFactor);
            }

            //im.set('width',this.screen.getPrimaryDisplay().size.width);
            //im.set('height',this.screen.getPrimaryDisplay().size.height);
            //im.set({originX: 'left', originY: 'top'});
            this.canvas.setBackgroundImage(im, () => {
                let cursorPoint = this.getCursorPoint();
                let left = cursorPoint.x - this.display.bounds.x;
                let top = cursorPoint.y - this.display.bounds.y;

                if (left < -this.display.size.width) left = -this.display.size.width;
                if (left > this.display.size.width) left = this.display.size.width;
                if (top < -this.display.size.height) top = -this.display.size.height;
                if (top > this.display.size.height) top = this.display.size.height;

                //console.log(this.screen.getCursorScreenPoint().x);
                //console.log(this.screen.getCursorScreenPoint().y);

                this.cropZone = new CropZone({
                    //left: this.screen.getCursorScreenPoint().x - this.display.bounds.x,
                    left: left,
                    width: 1,
                    //top: this.screen.getCursorScreenPoint().y - this.display.bounds.y,
                    top: top,
                    height: 1,
                    displayWidth: this.display.size.width * 2,
                    displayHeight: this.display.size.height * 2
                });
                this.canvas.add(this.cropZone);
                this.canvas.defaultCursor = 'crosshair';
                this.canvas.renderAll();
                //this.canvas.on('mouse:move',this.topCropConnerMove);
                //this.canvas.on('mouse:down', this.cropMouseDown);
                ipcRenderer.on('shown', (event, obj) => {
                    //console.log('shown');
                    this.mode = 'crop';
                    this.canvas.on('mouse:move', this.topCropConnerMove);
                    this.canvas.on('mouse:down', this.cropMouseDown);
                });
                ipcRenderer.send("screenshot-done", {});
            });

        });


    }

    _applyBase64Shot(dataUrl) {
         let image = new Image();//(this.screen.getPrimaryDisplay().size.width,this.screen.getPrimaryDisplay().size.height);
         image.onload = () => {
             let canvasEl = document.querySelector(this.selector);
             canvasEl.setAttribute("width", this.display.size.width + "px");
             canvasEl.setAttribute("height", this.display.size.height + "px");
             this.canvas = new fabric.Canvas(canvasEl, {
                 selection: false
             });

             let im = new fabric.Image(image, {});
             log.info("real thumb width: ", im.get('width'));
             log.info("real thumb height: ", im.get('height'));
             //если пришел скрин всех рабочих столов
             if (this.display.size.width * this.display.scaleFactor < im.get('width') || this.display.size.height * this.display.scaleFactor < im.get('height')) {
                 im.set('cropX', this.display.bounds.x * this.maxScaleFactor);
                 im.set('cropY', this.display.bounds.y * this.maxScaleFactor);
             }

             im.set('width', this.display.size.width * this.maxScaleFactor);
             im.set('height', this.display.size.height * this.maxScaleFactor);
             if (this.display.scaleFactor !== 1) {
                 im.scale(1 / this.maxScaleFactor);
             }

             //im.set('width',this.screen.getPrimaryDisplay().size.width);
             //im.set('height',this.screen.getPrimaryDisplay().size.height);
             //im.set({originX: 'left', originY: 'top'});
             this.canvas.setBackgroundImage(im, () => {
                 let left = this.screen.getCursorScreenPoint().x - this.display.bounds.x;
                 let top = this.screen.getCursorScreenPoint().y - this.display.bounds.y;

                 if (left < -this.display.size.width) left = -this.display.size.width;
                 if (left > this.display.size.width) left = this.display.size.width;
                 if (top < -this.display.size.height) top = -this.display.size.height;
                 if (top > this.display.size.height) top = this.display.size.height;

                 //console.log(this.screen.getCursorScreenPoint().x);
                 //console.log(this.screen.getCursorScreenPoint().y);
                 this.cropZone = new CropZone({
                     //left: this.screen.getCursorScreenPoint().x - this.display.bounds.x,
                     left: left,
                     width: 1,
                     //top: this.screen.getCursorScreenPoint().y - this.display.bounds.y,
                     top: top,
                     height: 1,
                     displayWidth: this.display.size.width * 2,
                     displayHeight: this.display.size.height * 2
                 });
                 this.canvas.add(this.cropZone);
                 this.canvas.defaultCursor = 'crosshair';
                 this.canvas.renderAll();
                 //this.canvas.on('mouse:move',this.topCropConnerMove);
                 //this.canvas.on('mouse:down', this.cropMouseDown);
                 ipcRenderer.on('shown', (event, obj) => {
                     //console.log('shown');
                     this.mode = 'crop';
                     this.canvas.on('mouse:move', this.topCropConnerMove);
                     this.canvas.on('mouse:down', this.cropMouseDown);
                 });
                 ipcRenderer.send("screenshot-done", {});
             });
             //this.canvas.setBackgroundImage(im);
             //this.canvas.add(im);
             //im.setWidth(this.screen.getPrimaryDisplay().size.width);
             //im.setHeight(this.screen.getPrimaryDisplay().size.height);


             //this._focusPlugin();


         };

         image.src = dataUrl;
     }

    _newScreenShot2(display) {
        this.handleStream = (stream) => {
            // console.log('stream',stream);
            // Create hidden video tag
            var video = document.createElement('video');
            video.style.cssText = 'position:absolute;top:-10000px;left:-10000px;';
            // Event connected to stream
            video.onloadedmetadata = () => {
                // Set video ORIGINAL height (screenshot)
                video.style.height = this.display.size.height * display.scaleFactor + 'px'; // videoHeight
                video.style.width = this.display.size.width * display.scaleFactor + 'px'; // videoWidth

                // Create canvas
                var canvas = document.createElement('canvas');
                canvas.width = this.display.size.width * display.scaleFactor;
                canvas.height = this.display.size.height * display.scaleFactor;
                var ctx = canvas.getContext('2d');
                // Draw video on canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                this._applyBase64Shot(canvas.toDataURL());

                // Remove hidden video tag
                video.remove();
                try {
                    // Destroy connect to stream
                    stream.getTracks()[0].stop();
                } catch (e) {
                }
            };
            video.src = URL.createObjectURL(stream);
            document.body.appendChild(video);
        };

        this.handleError = function (e) {
            console.log(e);
        };


        this.display = display;
        desktopCapturer.getSources({
            types: ['screen']
        }, (error, sources) => {
            if (error) throw error;
            // console.log(sources);
            let id = new String("screen:" + this.display.id);
            let source = sources.find((source) => {
                return source.id == id;
            });

            if (!source) {
                console.log("Can't find source id screen: " + this.display.id + " got: " + JSON.stringify(sources));
                id = sources[0].id;
            }

            navigator.webkitGetUserMedia({
                audio: false,
                video: {
                    /*width: this.display.size.width,
                    height: this.display.size.height,*/
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId:    id,
                        maxWidth: this.display.size.width * 2,
                        maxHeight: this.display.size.height * 2
                    }
                }
            }, this.handleStream, this.handleError);

        });
    }
}

var currentScreenShooter = new ScreenShooter("#screen-canvas", "#color-input", "#size-input", [desktopCapturer, ipcRenderer, screen]);

