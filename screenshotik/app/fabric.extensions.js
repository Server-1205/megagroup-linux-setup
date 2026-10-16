
var CropZone = fabric.util.createClass(fabric.Rect, {

    type: 'cropZone',

    initialize: function (options) {
        options || (options = {});
        this.set('fill', 'transparent');
        this.set('hasBorders', false);
        this.set('objectCaching', false);
        this.set('hasRotationPoint', false);
        this.set('hasControls', false);
        this.set('cornerColor', '#444');
        this.set('cornerSize', 8);
        this.set('selectable', false);
        this.set('originX','left');
        this.set('originY','top');
        this.set('transparentCorners', false);
        this.set('lockRotation', true);
        this.set('lockSkewingX', true);
        this.set('lockSkewingY', true);
        this.set('lockMovementX', true);
        this.set('lockMovementY', true);
        this.callSuper('initialize', options);
    },

    _render: function (ctx) {

        this.callSuper('_render', ctx);

        //var canvas = ctx.canvas;
        var dashWidth = 4;

        // Set original scale
        /*var flipX = this.flipX ? -1 : 1;
        var flipY = this.flipY ? -1 : 1;
        var scaleX = flipX / this.scaleX;
        var scaleY = flipY / this.scaleY;

        ctx.scale(scaleX, scaleY);*/

        // Overlay rendering
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this._renderOverlay(ctx);

        // Set dashed borders
        if (ctx.setLineDash !== undefined)
            ctx.setLineDash([dashWidth, dashWidth]);
        else if (ctx.mozDash !== undefined)
            ctx.mozDash = [dashWidth, dashWidth];
        // First lines rendering with black
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        // Re render lines in white
        ctx.lineWidth = 1;
        ctx.lineDashOffset = dashWidth;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this._renderSizeMarkers(ctx);
        //this._renderBorders(ctx);
        //this._renderGrid(ctx);

        // Reset scale
        //ctx.scale(1 / scaleX, 1 / scaleY);
    },

    _renderOverlay: function (ctx) {
        var canvas = ctx.canvas;

        //
        //    x0    x1        x2      x3
        // y0 +------------------------+
        //    |\\\\\\\\\\\\\\\\\\\\\\\\|
        //    |\\\\\\\\\\\\\\\\\\\\\\\\|
        // y1 +------+---------+-------+
        //    |\\\\\\|         |\\\\\\\|
        //    |\\\\\\|    0    |\\\\\\\|
        //    |\\\\\\|         |\\\\\\\|
        // y2 +------+---------+-------+
        //    |\\\\\\\\\\\\\\\\\\\\\\\\|
        //    |\\\\\\\\\\\\\\\\\\\\\\\\|
        // y3 +------------------------+
        //

        var x0 = Math.floor(-this.get('width') / 2 - this.get('left'));
        var x1 = Math.floor(-this.get('width') / 2);
        var x2 = Math.ceil(this.get('width') / 2);
        var x3 = Math.ceil(this.get('width') / 2 + (this.get('displayWidth') / 2 - this.get('width') - this.get('left')));

        var y0 = Math.floor(-this.get('height')/ 2 - this.get('top'));
        var y1 = Math.floor(-this.get('height') / 2);
        var y2 = Math.ceil(this.get('height') / 2);
        var y3 = Math.ceil(this.get('height') / 2 + (this.get('displayHeight') / 2 - this.get('height') - this.get('top')));

        ctx.beginPath();

        // Draw outer rectangle.
        // Numbers are +/-1 so that overlay edges don't get blurry.
        ctx.moveTo(x0 - 1, y0 - 1);
        ctx.lineTo(x3 + 1, y0 - 1);
        ctx.lineTo(x3 + 1, y3 + 1);
        ctx.lineTo(x0 - 1, y3 - 1);
        ctx.lineTo(x0 - 1, y0 - 1);
        ctx.closePath();

        // Draw inner rectangle.
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y1);
        ctx.lineTo(x1, y1);

        ctx.closePath();
        ctx.fill();
    },

    _renderSizeMarkers: function (ctx) {
        var canvas = ctx.canvas;
        var x0 = Math.floor(-this.get('width') / 2 - this.get('left'));
        var x1 = Math.floor(-this.get('width') / 2)-1;
        var x2 = Math.ceil(this.get('width') / 2);
        var x3 = Math.ceil(this.get('width') / 2 + (this.get('displayWidth') / 2 - this.get('width') - this.get('left')));

        var y0 = Math.floor(-this.get('height')/ 2 - this.get('top'));
        var y1 = Math.floor(-this.get('height') / 2)-1;
        var y2 = Math.ceil(this.get('height') / 2);
        var y3 = Math.ceil(this.get('height') / 2 + (this.get('displayHeight') / 2 - this.get('height') - this.get('top')));
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(x1, y0);
        ctx.lineTo(x1, y3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0, y1);
        ctx.lineTo(x3, y1);
        ctx.stroke();
        if (this.get('width')>2) {
            ctx.beginPath();
            ctx.moveTo(x2, y0);
            ctx.lineTo(x2, y3);
            ctx.stroke();
        }

        if (this.get('height')>2) {
            ctx.beginPath();
            ctx.moveTo(x0, y2);
            ctx.lineTo(x3, y2);
            ctx.stroke();
        }
        ctx.font = "normal 12px sans-serif";
        ctx.textAlign = "start";
        ctx.textBaseline="top";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(" " + this.get('width') + "x" + this.get('height'),x2,y2);
        ctx.font = "normal 12px sans-serif";
        ctx.textAlign = "end";
        ctx.textBaseline="top";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("X:" + this.get("left") + " ",x1,y1);
        ctx.textAlign = "start";
        ctx.textBaseline="bottom";
        ctx.fillText(" Y:" + this.get("top"),x1,y1);

    }
});


(function() {



    var fabric = global.fabric || (global.fabric = { }),
        extend = fabric.util.object.extend,
        min = fabric.util.array.min,
        max = fabric.util.array.max,
        toFixed = fabric.util.toFixed,
        coordProps = { x1: 1, x2: 1, y1: 1, y2: 1, weight: 1},
        NUM_FRACTION_DIGITS = fabric.Object.NUM_FRACTION_DIGITS;

    if (fabric.Arrow) {
        fabric.warn('fabric.Arrow is already defined');
        return;
    }

    var cacheProperties = fabric.Object.prototype.cacheProperties.concat();
    cacheProperties.push(
        'x1',
        'x2',
        'y1',
        'y2'
    );
    cacheProperties.push('points');
    cacheProperties.push('weight');

    /**
     * Polyline class
     * @class fabric.Polyline
     * @extends fabric.Object
     * @see {@link fabric.Polyline#initialize} for constructor definition
     */
    fabric.Arrow = fabric.util.createClass(fabric.Object, /** @lends fabric.Polyline.prototype */ {

        /**
         * Type of an object
         * @type String
         * @default
         */
        type: 'arrow',

        /**
         * Points array
         * @type Array
         * @default
         */
        points: null,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        weight: 1,

        _set: function(key, value) {
            this.callSuper('_set', key, value);
            if (typeof coordProps[key] !== 'undefined') {
                this[key] = value;
                this.points = this._calcPoints();
                this.angle = this._calcAngle();
                var dim = this._calcDimensions();
                this.width = dim.width;
                this.height = dim.height;
                this.set('width',dim.width);
                this.set('height',dim.height);
                this.set('angle',this.angle);
                this.set('points',this.points);
                this.pathOffset = {
                    x: dim.left + this.width / 2,
                    y: dim.top + this.height / 2
                };
            }
            return this;
        },

        cacheProperties: cacheProperties,

        _calcLength: function(){
            return Math.round(Math.sqrt(Math.pow(this.x1-this.x2,2) + Math.pow(this.y1-this.y2,2)));
        },

        _calcPoints: function() {
            let length = this._calcLength();
            if  (length === 0) length=5;
            let arrowWidth = Math.round(length/6) ;
            if (arrowWidth > 20*this.weight) arrowWidth = Math.abs(20*this.weight);
            let tailWidth = Math.round(arrowWidth/9);
            /*return  [
                {x: tailWidth, y: 0},
                {x: 0, y: -tailWidth},
                {x: length-arrowWidth*0.8, y: -(Math.round(0.2*arrowWidth))},
                {x: length-arrowWidth, y: - arrowWidth},
                {x: length, y: 0},
                {x: length-arrowWidth, y: arrowWidth},
                {x: length-arrowWidth*0.8, y: (Math.round(0.2*arrowWidth))},
                {x: 0, y: tailWidth},
                {x: tailWidth, y: 0}
            ];*/
            return  [
                {x: 0, y: 0},
                {x: 0, y: -tailWidth*0.7},
                {x: length-arrowWidth*1.3, y: -arrowWidth/3},
                {x: length-arrowWidth*1.5, y: -arrowWidth},
                {x: length, y: 0},
                {x: length-arrowWidth*1.5, y: arrowWidth},
                {x: length-arrowWidth*1.3, y: arrowWidth/3},
                {x: 0, y: tailWidth*0.7},
                {x: 0, y: 0}
            ];
        },

        _calcAngle: function() {
            return fabric.util.radiansToDegrees(Math.atan2(this.y2,this.x2));
        },

        /**
         * Constructor
         * @param {Array} points Array of points (where each point is an object with x and y)
         * @param {Object} [options] Options object
         * @return {fabric.Polyline} thisArg
         * @example
         * var poly = new fabric.Polyline([
         *     { x: 10, y: 10 },
         *     { x: 50, y: 30 },
         *     { x: 40, y: 70 },
         *     { x: 60, y: 50 },
         *     { x: 100, y: 150 },
         *     { x: 40, y: 100 }
         *   ], {
     *   stroke: 'red',
     *   left: 100,
     *   top: 100
     * });
         */
        initialize: function(coords, options) {
            options = options || {};
            this.set('originX','left');
            this.set('originY','center');
            this.set('hasBorders', false);
            this.set('selectable', false);
            this.set('hasControls',false);
            this.set('lockRotation',true);
            this.set('lockScalingX',true);
            this.set('lockScalingY',true);
            //this.set('statefullCache', true);
            //this.set('objectCaching', false);
            this.callSuper('initialize', options);
            /*this.set('originX','left');
            this.set('originY','center');
            this.set('originY','center');*/
            //this.set('selectable',false);
            //this.set('evented','false,
            /*this.set('lockMovementX',true);
            this.set('lockMovementY',true);
            this.set('lockRotation',true);
            this.set('lockScalingX',true);
            this.set('lockScalingY',true);
            this.set('hasControls',false);*/
            //this.set('hasBorders',false);
            //this.x1 = coords[0];
            //this.y1 = coords[1];
            //this.x2 = coords[2];
            //this.y2 = coords[3];
            this.set('x1',coords[0]);
            this.set('y1',coords[1]);
            this.set('x2',coords[2]);
            this.set('y2',coords[3]);
            var calcDim = this._calcDimensions();
            if (typeof options.left === 'undefined') {
                this.left = calcDim.left;
            }
            if (typeof options.weight !== 'undefined') {
                this.set('weight',options.weight);
            }
            if (typeof options.top === 'undefined') {
                this.top = calcDim.top;
            }
            /*this.pathOffset = {
                x: calcDim.left + this.width / 2,
                y: calcDim.top + this.height / 2
            };*/
        },

        /**
         * Calculate the polygon min and max point from points array,
         * returning an object with left, top, widht, height to measure the
         * polygon size
         * @return {Object} object.left X coordinate of the polygon leftmost point
         * @return {Object} object.top Y coordinate of the polygon topmost point
         * @return {Object} object.width distance between X coordinates of the polygon leftmost and rightmost point
         * @return {Object} object.height distance between Y coordinates of the polygon topmost and bottommost point
         * @private
         */
        _calcDimensions: function() {

            var points = this.points,
                minX = min(points, 'x') || 0,
                minY = min(points, 'y') || 0,
                maxX = max(points, 'x') || 0,
                maxY = max(points, 'y') || 0,
                width = (maxX - minX),
                height = (maxY - minY);

            return {
                left: minX,
                top: minY,
                width: width,
                height: height
            };
        },

        /**
         * Returns object representation of an instance
         * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
         * @return {Object} Object representation of an instance
         */
        toObject: function(propertiesToInclude) {
            return extend(this.callSuper('toObject', propertiesToInclude), {
                points: this.points.concat()
            });
        },

        /* _TO_SVG_START_ */
        /**
         * Returns svg representation of an instance
         * @param {Function} [reviver] Method for further parsing of svg representation.
         * @return {String} svg representation of an instance
         */
        toSVG: function(reviver) {
            var points = [],
                diffX = 0,
                diffY = 0,
                markup = this._createBaseSVGMarkup();

            if (!(this.group && this.group.type === 'path-group')) {
                diffX = this.pathOffset.x;
                diffY = this.pathOffset.y;
            }

            for (var i = 0, len = this.points.length; i < len; i++) {
                points.push(
                    toFixed(this.points[i].x - diffX, NUM_FRACTION_DIGITS), ',',
                    toFixed(this.points[i].y - diffY, NUM_FRACTION_DIGITS), ' '
                );
            }
            markup.push(
                '<', this.type, ' ', this.getSvgId(),
                'points="', points.join(''),
                '" style="', this.getSvgStyles(),
                '" transform="', this.getSvgTransform(),
                ' ', this.getSvgTransformMatrix(),
                '"/>\n'
            );

            return reviver ? reviver(markup.join('')) : markup.join('');
        },
        /* _TO_SVG_END_ */


        /**
         * @private
         * @param {CanvasRenderingContext2D} ctx Context to render on
         * @param {Boolean} noTransform
         */
        commonRender: function(ctx, noTransform) {
            var point, len = this.points.length,
                x = noTransform ? 0 : this.pathOffset.x,
                y = noTransform ? 0 : this.pathOffset.y;

            if (!len || isNaN(this.points[len - 1].y)) {
                // do not draw if no points or odd points
                // NaN comes from parseFloat of a empty string in parser
                return false;
            }
            ctx.beginPath();
            ctx.moveTo(this.points[0].x - x, this.points[0].y - y);
            for (var i = 0; i < len; i++) {
                point = this.points[i];
                ctx.lineTo(point.x - x, point.y - y);
            }
            return true;
        },

        /**
         * @private
         * @param {CanvasRenderingContext2D} ctx Context to render on
         * @param {Boolean} noTransform
         */
        _render: function(ctx, noTransform) {
            if (!this.commonRender(ctx, noTransform)) {
                return;
            }
            this._renderFill(ctx);
            this._renderStroke(ctx);
        },

        /**
         * @private
         * @param {CanvasRenderingContext2D} ctx Context to render on
         */
        _renderDashedStroke: function(ctx) {
            var p1, p2;

            ctx.beginPath();
            for (var i = 0, len = this.points.length; i < len; i++) {
                p1 = this.points[i];
                p2 = this.points[i + 1] || p1;
                fabric.util.drawDashedLine(ctx, p1.x, p1.y, p2.x, p2.y, this.strokeDashArray);
            }
        },

        /**
         * Returns complexity of an instance
         * @return {Number} complexity of this instance
         */
        complexity: function() {
            return this.get('points').length;
        }
    });

    /* _FROM_SVG_START_ */
    /**
     * List of attribute names to account for when parsing SVG element (used by {@link fabric.Polyline.fromElement})
     * @static
     * @memberOf fabric.Polyline
     * @see: http://www.w3.org/TR/SVG/shapes.html#PolylineElement
     */
    fabric.Arrow.ATTRIBUTE_NAMES = fabric.SHARED_ATTRIBUTES.concat();

    /**
     * Returns fabric.Polyline instance from an SVG element
     * @static
     * @memberOf fabric.Polyline
     * @param {SVGElement} element Element to parse
     * @param {Object} [options] Options object
     * @return {fabric.Polyline} Instance of fabric.Polyline
     */
    fabric.Arrow.fromElement = function(element, options) {
        if (!element) {
            return null;
        }
        options || (options = { });

        var points = fabric.parsePointsAttribute(element.getAttribute('points')),
            parsedAttributes = fabric.parseAttributes(element, fabric.Arrow.ATTRIBUTE_NAMES);

        return new fabric.Arrow(points, fabric.util.object.extend(parsedAttributes, options));
    };
    /* _FROM_SVG_END_ */

    /**
     * Returns fabric.Polyline instance from an object representation
     * @static
     * @memberOf fabric.Polyline
     * @param {Object} object Object to create an instance from
     * @param {Function} [callback] Callback to invoke when an fabric.Path instance is created
     * @param {Boolean} [forceAsync] Force an async behaviour trying to create pattern first
     * @return {fabric.Polyline} Instance of fabric.Polyline
     */
    fabric.Arrow.fromObject = function(object, callback, forceAsync) {
        return fabric.Object._fromObject('Arrow', object, callback, forceAsync, 'points');
    };


})();
