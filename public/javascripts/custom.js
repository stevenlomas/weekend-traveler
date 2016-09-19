/**
 * custom.js
 *
 * @author Steven Lomas, n8578443
 */
"use strict";

// Icons for Google Maps Markers
const icons = {
    attraction: '/images/pin_attraction.png',
    hotel: '/images/pin_hotel.png'
};


/**
 * On document ready attach animations
 */
jQuery(document).ready(function($) {
    // Fade error message in and out
    $('#message').fadeIn('slow');
    setTimeout(function() {
        $('#message').fadeOut('slow');
    }, 6000);

    // Constrain departure date to arrival
    $('input[name="check_in"]').change(function() {
        $('input[name="check_out"]').attr('min', $(this).val());
    });
});


/**
 * Create Google Maps object
 */
function createMap() {
    var canvas = $('#map_canvas');
    var center = new google.maps.LatLng(canvas.data('lat'), canvas.data('lng'));

    // Options for Google Base Map
    var mapOptions = {
        center: center,
        zoom: 7,
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        minZoom: 5,
        panControl: false,
        scaleControl: true,
        scaleControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_LEFT
        },
        streetViewControl: false
    };

    // Styling for Google Base Map
    var styles = [{
        featureType: "transit",
        elementType: "labels",
        stylers: [{ visibility: "off" }] // Remove clickable objects
    }, {
        featureType: "poi",
        stylers: [{ visibility: "off" }] // Remove clickable objects
    }];

    // Create DrawingManager
    var drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [
                google.maps.drawing.OverlayType.MARKER
            ]
        }
    });

    // Create DirectionsService and DirectionsRenderer
    var directionsService = new google.maps.DirectionsService();
    var directionsDisplay = new google.maps.DirectionsRenderer();

    // Set up Map, set styles, and connect DrawingManager
    var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
    map.setOptions({ styles: styles });
    drawingManager.setMap(map);
    directionsDisplay.setMap(map);

    // Get directions
    var start = canvas.data('start');
    var end = canvas.data('end');
    canvas.removeAttr('data-start').removeAttr('data-end');

    var request = {
        origin: start,
        destination: end,
        travelMode: 'DRIVING',
        avoidTolls: true
    };

    // Google Maps Javascript Library does not handle the returned directions route from server
    // So we make another call to get and draw the path
    directionsService.route(request, function(result, status) {
        if (status == 'OK') {
            // Display directions polyline on map
            directionsDisplay.setDirections(result);
        }
    });

    // Bind attraction and hotel node events
    $('.attraction').each(function() {
        bindNode(this, map, 'attraction');
    });
    $('.hotel').each(function() {
        bindNode(this, map, 'hotel');
    });
    $('#venue_closer').click(function() {
        $('#venue_container').attr('src', 'javascript:false;').hide();
        $(this).hide();
    });

    // Set information div height precisely
    $('#information').css('top', $('#trip').height() + 28 + 'px');
    $('#venue_container').css('top', $('#trip').height() + 28 + 'px');
    $('#venue_closer').css('top', $('#trip').height() + 43 + 'px');

    // All Event Listeners go here
    /*google.maps.event.addListener(capmap.map, 'dragend', updateMapCenter);
    google.maps.event.addListener(capmap.map, 'zoom_changed', updateMapZoom);
    google.maps.event.addListener(capmap.map, 'rightclick', finishedDrawing);
    google.maps.event.addListener(capmap.drawingManager, 'markercomplete', createMarker);
    google.maps.event.addListener(capmap.drawingManager, 'polylinecomplete', createLine);
    google.maps.event.addListener(capmap.drawingManager, 'polygoncomplete', createPolygon);
    google.maps.event.addDomListener(document, 'keydown', keyShortcut, false);
    google.maps.event.addDomListener(window, 'resize', updateMapCenter);*/
}


/**
 * Bind attraction and hotel node events
 *
 * @param obj jQuery attraction or hotel DOM object
 * @param map Google Maps map object
 * @param type String description of object type
 */
function bindNode(obj, map, type) {
    var node = new google.maps.LatLng($(obj).data('lat'), $(obj).data('lng'));
    var offset = $(obj).offset().top - $('#trip').height() + 28;
    var name = $(obj).data('name');

    // Place marker on map
    var marker = new google.maps.Marker({
        icon: location.protocol + '//' + location.host +
        (type === 'hotel' ? '/images/pin-hotel.png' : '/images/pin-attraction.png'),
        map: map,
        position: node,
        title: name
    });

    // Pan to node on map when clicked on information pane
    $(obj).children('h3').click(function() {
        map.panTo(node);
    });

    // Request more information for venue
    $(obj).children('.more').click(function() {
        var id = $(obj).data('id');
        $('#venue_container').attr('src', location.protocol + '//' + location.host + '/venue/' + id).fadeIn('slow');
        $('#venue_closer').fadeIn('slow');
    });

    // Click Marker Event Handler
    google.maps.event.addListener(marker, 'click', function () {
        // Scroll to information
        $('#information').stop().animate({
            'scrollTop': offset
        }, 500, 'swing');
        // Highlight information
        $(obj).stop().css("background-color", "#FFFFFF").animate({
            backgroundColor: "#EEEEEE"
        }, 3000);
    });
}
