/**
 * api.js
 *
 * @author Steven Lomas, n8578443
 */
"use strict";
var exports = module.exports = {};
var request = require('request');
var async = require('async');
var fs = require('fs');
var util = require('./util');

// API Keys File
const keys = JSON.parse(fs.readFileSync('./settings/keys.json', 'utf8'));


/**
 * Google Maps Directions
 *
 * @param {object} context Current template context
 * @param {ServerResponse} res Server response object
 */
exports.getMap = function(context, res) {
    var api = 'https://maps.googleapis.com/maps/api/directions/json';
    var key = keys.maps.api; // API key
    var mode = 'driving'; // Travel mode
    var avoid = 'tolls'; // Avoid, i.e. tolls, highways
    var language = 'en-AU'; // Text language
    var units = 'metric'; // Text units

    // Request parameters
    var params = {
        'origin': context.origin,
        'destination': context.destination,
        'mode': mode,
        'avoid': avoid,
        'language': language,
        'units': units,
        'key': key
    };

    request({
        url: api, //URL to hit
        qs: params, //Query string data
        method: 'GET' //Specify the request method
    }, function(error, response, body) {
        if (error) {
            // Response Error
            context.message = error;
            console.log(context.message);
            res.render('index', context);
            return null;
        } else {
            // Response Success
            var data = JSON.parse(body);
            if (data.error_message || data.routes.length === 0 ) {
                context.message = 'No directions found for trip ' + context.origin + ' to ' + context.destination;
                console.log(context.message);
                res.render('index', context);
                return null;
            }
            console.log('Google Maps Directions API returned: ' + response.statusCode);

            const attractionDistance = 60000; // Minimum distance in meters between attractions
            const hotelDistance = 300000; // Minimum distance in meters between hotels
            const minDistance = attractionDistance / 2;
            const maxDistance = 4000000;

            // Parse data
            context.map = data.routes[0].legs[0];
            context.overview = data.routes[0].overview_polyline.points;

            // Extract distance
            var distance = parseInt(context.map.distance.value); // Travel distance in meters

            // Filter extreme trips
            if (distance < minDistance) {
                context.message = 'Trip too short. The total distance is shorter than ' + minDistance / 1000 + 'km.';
                console.log(context.message);
                res.render('index', context);
                return null;
            } else if (distance > maxDistance) {
                context.message = 'Trip too long. The total distance is larger than ' + maxDistance / 1000 + 'km.';
                console.log(context.message);
                res.render('index', context);
                return null;
            }

            // Find center of route
            context.center = {
                'lat': (data.routes[0].bounds.northeast.lat + data.routes[0].bounds.southwest.lat) / 2,
                'lng': (data.routes[0].bounds.northeast.lng + data.routes[0].bounds.southwest.lng) / 2
            };

            const maxAttractionNodes = 10; // Limit to prevent excess API calls
            const maxHotelNodes = 4; // Limit to prevent excess API calls

            // Calculate number of search nodes needed, based upon search circumference and travel distance
            // Ignore last stint for on-the-way attractions, and constrain to max queries
            context.attractionNodes = Math.floor(Math.max((distance - (attractionDistance / 2)), 0) / attractionDistance);
            context.attractionNodes = (context.attractionNodes <= maxAttractionNodes ? context.attractionNodes : maxAttractionNodes);
            context.hotelNodes = Math.floor(Math.max((distance - (hotelDistance / 2)), 0) / hotelDistance);
            context.hotelNodes = (context.hotelNodes <= maxHotelNodes ? context.hotelNodes : maxHotelNodes);

            // Decode encoded polylines
            var nodes = util.decodePolyline(decodeURI(context.overview));

            // Get lat/lng nodes for hotel and attraction queries
            context.attractionSearchNodes = util.getNodes(nodes, context.attractionNodes);
            context.hotelSearchNodes = util.getNodes(nodes, context.hotelNodes);

            // Get rid of directions search data
            delete context.origin;
            delete context.destination;
            delete context.overview;

            // Begin getting attraction data
            getAttractions(context, res);
        }
    });
};

/**
 * Foursquare Explore Venues
 * Requests per hour: 5000
 * VERSION FORMAT: YYYYMMDD
 *
 * @param {object} context Current template context
 * @param {ServerResponse} res Server response object
 * */
function getAttractions(context, res) {
    var api = 'https://api.foursquare.com/v2/venues/explore';
    var client_id = keys.attractions.id; // API Client id
    var client_secret = keys.attractions.secret; // API Client secret
    var limit = 10; // Results limit
    var radius = 25000; // Search radius in meters
    var time = 'any';
    var day = 'any';
    var venuePhotos = '1'; // Include photos for each venue
    var v = '20160908'; // API version (date)
    var m = 'foursquare'; // Data source (foursquare or swarm)
    var tasks = []; // Array of asyncronous tasks to execute in parallel

    context.attractionSearchNodes.forEach(function(node, n) {
        tasks.push(function(callback) {
            // Build request parameters
            var params = {
                'll': String(node[0]) + ',' + String(node[1]),
                'limit': limit,
                'radius': radius,
                'section': context.section,
                'time': time,
                'day': day,
                'venuePhotos': venuePhotos,
                'v': v,
                'm': m,
                'client_id': client_id,
                'client_secret': client_secret
            };

            // Make API request
            request({
                url: api, // API url
                qs: params, // Query data
                method: 'GET' // Request method
            }, function(error, response, body) {
                if (error) {
                    // Response Error, log and return
                    console.log(error);
                    callback(error);
                } else {
                    // Response Success, parse and process data
                    var data = JSON.parse(body);
                    if (data.meta.code == 200) {
                        console.log('Foursquare Explore Venues API returned: ' +
                            response.statusCode + ' @ ' + params.ll);
                        var attractions = data.response.groups[0].items;

                        // Return result
                        callback(null, attractions);
                    } else {
                        // Response success but query returned error
                        callback(data.meta.code);
                    }
                }
            });
        });
    });

    // Run API calls and process resulting data
    async.parallel(tasks, function(err, results) {
        if (err) {
            // Task returned error
            console.log('Foursquare Explore Venues API returned:' + err);
            // Check for any result data
            if (!results) {
                // All failed, no data, return
                context.message = 'No attraction data!';
                console.log(context, message);
                res.render('index', context);
                return null;
            }
        }

        // Split out resulting arrays and find duplicates?
        var attractionData = [];
        results.forEach(function(result, r) {
            result.forEach(function(attraction, a) {
                // Search previous data chunk for overlapping `attractionData[a].venue.id`
                attractionData.push(attraction);
            });
        });

        // Store attraction data
        context.attractions = attractionData;
        // Get rid of attraction search data
        delete context.attractionSearchNodes;
        delete context.section;

        // Begin getting hotel data
        getHotels(context, res);
    });
}

/**
 * Amadeus Hotel Geosearch by circle
 * Requests per month: 5000
 * Requests per second: 5
 * DATE FORMAT: YYYY-MM-DD
 *
 * @param {object} context Current template context
 * @param {ServerResponse} res Server response object
 * */
function getHotels(context, res) {
    var api = 'https://api.sandbox.amadeus.com/v1.2/hotels/search-circle';
    var apikey = keys.hotels.api; // API key
    var number_of_results = 20; // Results limit
    var radius = 50; // Search radius in Kilometers
    var lang = 'EN'; // English
    var currency = 'AUD'; // Australian Dollars
    var tasks = []; // Array of asyncronous tasks to execute in parallel

    context.hotelSearchNodes.forEach(function(node) {
        tasks.push(function(callback) {
            // Build request parameters
            var params = {
                'latitude': node[0],
                'longitude': node[1],
                'number_of_results': number_of_results,
                'radius': radius,
                'lang': lang,
                'currency': currency,
                'check_in': context.check_in,
                'check_out': context.check_out,
                'apikey': apikey,
                'amenity': context.amenities
            };

            // Make API request
            request({
                url: api, // API url
                qs: params, // Query data
                method: 'GET' // Request method
            }, function(error, response, body) {
                if (error) {
                    // Response Error, log and return
                    console.log(error);
                    callback(error);
                } else {
                    // Response Success, parse and process data
                    var data = JSON.parse(body);
                    if (data.results) {
                        console.log('Amadeus Hotel Geosearch by circle API returned: ' +
                            response.statusCode + ' @ ' + params.latitude + ', ' + params.longitude);
                        var hotels = data.results;

                        // Return result
                        callback(null, hotels);
                    } else {
                        // Response success but query returned error
                        callback(data.status);
                    }
                }
            });
        });
    });

    // Run API calls and process resulting data
    async.parallel(tasks, function(err, results) {
        if (err) {
            // Task returned error
            console.log('Amadeus Hotel Geosearch by circle API returned:' + err);
            // Check for any result data
            if (!results) {
                // All failed, no data, return
                context.message = 'No hotel data!';
                console.log(context.message);
                res.render('index', context);
                return null;
            }
        }

        // Split out resulting arrays
        var hotelData = [];
        results.forEach(function(result, r) {
            if (result === undefined) {
                return false;
            } else {
                result.forEach(function(hotel, h) {
                    hotelData.push(hotel);
                });
            }
        });

        // Convert date format
        var checkin = new Date(context.check_in);
        context.check_in = checkin.toDateString();
        var checkout = new Date(context.check_out);
        context.check_out = checkout.toDateString();

        // Store the hotel data
        context.hotels = hotelData;
        // Get rid of hotel search data
        delete context.hotelSearchNodes;
        delete context.amenities;

        // Template context is ready to render
        res.render('map', context);
    });
}

/**
 * Foursquare Venue Details
 * Requests per hour: 5000
 *
 * @param {object} context Current template context
 * @param {ServerResponse} res Server response object
 */
exports.getVenue = function(context, res) {
    var api = 'https://api.foursquare.com/v2/venues/' + context.id;
    var client_id = keys.attractions.id; // API Client id
    var client_secret = keys.attractions.secret; // API Client secret
    var v = '20160908'; // API version (date)
    var m = 'foursquare'; // Data source (foursquare or swarm)
    var message = '';

    // Request parameters
    var params = {
        'v': v,
        'm': m,
        'client_id': client_id,
        'client_secret': client_secret
    };

    request({
        url: api, // API url
        qs: params, // Query data
        method: 'GET' // Request method
    }, function(error, response, body) {
        if (error) {
            // Response Error, log and return
            // All failed, no data, return
            context.message = 'getVenue response error for attraction ' + context.id;
            console.log(message);
            res.render('venue', context);
            return null;
        } else {
            // Response Success, parse and process data
            var data = JSON.parse(body);
            if (data.meta.code == 200) {
                console.log('Foursquare Venues API returned: ' +
                    response.statusCode + ' @ ' + context.id);
                context.venue = data.response.venue;
                if (context.venue.bestPhoto) {
                    context.background = 'background: url("' + context.venue.bestPhoto.prefix + '350x350' +
                        context.venue.bestPhoto.suffix + '") no-repeat center; background-size: cover;';
                } else {
                    context.background = '';
                }

                // Render result
                res.render('venue', context);
            } else {
                // Response success but query returned error
                context.message = 'No data found for attraction ' + context.id;
                console.log(message);
                res.render('venue', context);
                return null;
            }
        }
    });
};
