/**
 * api.js
 *
 * @author Steven Lomas
 * @author n8578443
 */
"use strict";
var express = require('express');
var router = express.Router();
var api = require('./api');

// Application Title
var title = 'Weekend Traveler';


/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: title });
});

/* GET and POST map. */
router.get('/map', function(req, res) {
  // No POST data
  // Redirect users to homepage
  res.redirect('/');
}).post('/map', function(req, res) {
    // Extract POST data and validate
    const place = /^[\w\s]{3,30}$/; // 3 to 30 letters including spaces
    const section = /^[a-zA-Z]*$/; // Empty string or letters
    const date = /^201[6-9]-(0[1-9]|1[0-2])-([1-2][0-9]|0[1-9]|3[0-1])$/; // 2016-01-01 to 2019-12-31
    const rate = /^([1-4][0-9][0-9]|500)$/; // 100 to 500

    // Build template context
    var context = {
        title: title + ' Map'
    };

    // Validate inputs and continue building template context
    (place.test(req.body.origin) ? context.origin = req.body.origin : context.message = 'Invalid origin.');
    (place.test(req.body.destination) ? context.destination = req.body.destination : context.message = 'Invalid destination.');
    (section.test(req.body.section) ? context.section = req.body.section : context.message = 'Invalid attraction type(s).');
    (date.test(req.body.check_in) ? context.check_in = req.body.check_in : context.message = 'Invalid check in date.');
    (date.test(req.body.check_out) ? context.check_out = req.body.check_out : context.message = 'Invalid check in date.');
    (rate.test(req.body.max_rate) ? context.max_rate = req.body.max_rate : context.message = 'Invalid max daily hotel rate.');
    (req.body.amenities === undefined ? context.amenities = [] : context.amenities = req.body.amenities);

    if (context.message) {
        res.render('index', context);
        return null;
    }

    // Start building map context from Google Maps Directions API
    api.getMap(context, res);
});

/* GET vanue information. */
router.get('/venue/:venueId', function(req, res) {
    const id = /^[a-f0-9]{24}$/;

    // Exclute invalid venues
    if (!id.test(req.params.venueId)) {
        res.status(404);
        res.send('Not found');
    }

    // Build template context
    var context = {
        title: title + ' Venue',
        id: req.params.venueId
    };

    api.getVenue(context, res);
});

module.exports = router;
