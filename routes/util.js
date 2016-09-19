/**
 * util.js
 *
 * @author Steven Lomas, n8578443
 */
"use strict";
var exports = module.exports = {};


/**
 * Decodes an encoded Polyline into a Point Array
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * Using implementation: https://github.com/mapbox/polyline/blob/master/src/polyline.js
 *
 * @param {string} polyline Encoded polyline
 * @return {array} points Array of lat/lng points
 * */
exports.decodePolyline = function(polyline) {
    var points = []; // 2D array of coordinate points
    var byte = null; // Char
    var shift = 0; // Current bit chunk
    var point = 0;
    var lat = 0;
    var lat_delta = 0; // Delta from previous lat
    var lng = 0;
    var lng_delta = 0; // Delta from previous lng
    var factor = 100000; // Integer to Float factor

    // Decode variable length encoded polyline into coordinates array
    for (var i = 0; i < polyline.length;) {
        // Clear shift and current point
        shift = 0;
        point = 0;

        do {
            byte = polyline.charCodeAt(i++) - 63; // Base64 Ascii to decimal
            point |= (byte & 0x1f) << shift; // Shift 5-bit chunk and invert
            shift += 5;
        } while (byte >= 0x20);

        // Two's compliment for negative values
        lat_delta = ((point & 1) ? ~(point >> 1) : (point >> 1));

        // Clear shift and current point
        shift = 0;
        point = 0;

        do {
            byte = polyline.charCodeAt(i++) - 63; // Base64 Ascii to decimal
            point |= (byte & 0x1f) << shift; // Shift 5-bit chunk and invert
            shift += 5;
        } while (byte >= 0x20);

        // Two's compliment for negative values
        lng_delta = ((point & 1) ? ~(point >> 1) : (point >> 1));

        // Sum deltas, convert Integers to Floats, and push new lat/lng pair into array
        lat += lat_delta;
        lng += lng_delta;
        points.push([lat / factor, lng / factor]);
    }

    return points;
};

/**
 * Builds an array of equidistant lat/long nodes based upon step distribution
 *
 * @param {array} points Latitude/Longitude list representing the trip overview
 * @param {int} searchNumber The number of along-the-way nodes to return
 * @return {array} searchNodes Latitude/Longitude list of search nodes
 * */
exports.getNodes = function(points, searchNumber) {
    var searchNodes = [];
    var average = points.length / (searchNumber + 1);
    var node = 0;

    // Push along-the-way nodes
    for (var a = 0; a < searchNumber; a++) {
        node = Math.round(a * average + average);
        searchNodes.push([points[node][0], points[node][1]]);
        //console.log((a + 1) + '@' + node + ': ' + points[node][0] + ', ' + points[node][1]);
    }
    // Push in final stop
    searchNodes.push([points[points.length - 1][0], points[points.length - 1][1]]);

    return searchNodes;
};
