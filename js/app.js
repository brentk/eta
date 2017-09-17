var Eta = Eta || {};

Eta.startLoading = function() {
	if(window.isLoading) {
		return;
	}
	window.isLoading = true;
	$("#overlay").fadeIn("fast");
}

Eta.stopLoading = function() {
	window.isLoading = false;
	$("#overlay").fadeOut("fast", function() {
	});
}

Eta.getGeocoder = function() {
	if (!Eta.geocoder) {
		Eta.geocoder = new google.maps.Geocoder();
	}
	return Eta.geocoder;
}

Eta.getDirectionsRenderer = function() {
	if (!Eta.DirectionsRenderer) {
		Eta.DirectionsRenderer = new google.maps.DirectionsRenderer();
		Eta.DirectionsRenderer.setMap(Eta.map);
	}
	return Eta.DirectionsRenderer;
}

Eta.getDirectionsService = function() {
	if (!Eta.DirectionsService) {
		Eta.DirectionsService = new google.maps.DirectionsService();
	}
	return Eta.DirectionsService;
}

$(document).ready( function() {
	Eta.map = new google.maps.Map(document.getElementById('map'), {
		zoom: 4,
		center: {lat: 37.781742, lng: -98.357331},
		mapTypeControlOptions: {
			mapTypeIds: ["roadmap", "styled_map"],
		},
	});

	Eta.map.mapTypes.set("styled_map", Eta.styledMapType);
	Eta.map.setMapTypeId("styled_map");

	if (localStorage.destinationAddress) {
		$("#address").val(localStorage.destinationAddress);
	}

	$("#phone").mask("(999) 999-9999");

	if (localStorage.phone) {
		$("#phone").val(localStorage.phone);
	}

	$("#back-button").click(function(e) {
		e.preventDefault();
		if (Eta.destinationMarker) {
			Eta.destinationMarker.setMap(null);
		}
		$("#send-it").fadeOut("fast", function() {
			$("#calc-it").fadeIn("fast");
		})
	});

	$("#send-it").submit(function(e) {
		e.preventDefault();
		localStorage.phone = $("#phone").val();

		var eta = moment();
		eta.add(Eta.value, "seconds");

		var link = "sms:" + $("#phone").val();
		link += "&body=Leaving, ETA: " + eta.format("h:mma");
		console.log(link);
		$("#sms").attr("href", link);

		document.getElementById('sms').click();
	});

	$("#calc-it").submit(function(e) {
		Eta.startLoading();
		e.preventDefault();
		localStorage.destinationAddress = $("#address").val();

		Eta.getGeocoder().geocode( { address: localStorage.destinationAddress }, function (results, status) {

			if (status == "OK") {
				Eta.destination = results[0].geometry.location;

				if (Eta.destinationMarker) {
					Eta.destinationMarker.setMap(null);
				}

				Eta.destinationMarker = new google.maps.Marker({
					animation: google.maps.Animation.DROP,
					position: Eta.destination,
					map: Eta.map,
				});

				Eta.bounds = new google.maps.LatLngBounds();
				Eta.bounds.extend(Eta.origin.coords);
				Eta.bounds.extend(Eta.destination);
				Eta.map.fitBounds(Eta.bounds);

				Eta.getDirectionsService().route({
					origin: Eta.origin.coords,
					destination: Eta.destination,
					unitSystem: google.maps.UnitSystem.IMPERIAL,
					travelMode: "DRIVING",
					drivingOptions: {
						departureTime: new Date(),
						trafficModel: 'bestguess'
					}
				}, function (response, status) {
					if (status == "OK") {
						Eta.getDirectionsRenderer().setDirections(response);
						Eta.text = response.routes[0].legs[0].duration_in_traffic.text;
						Eta.value = response.routes[0].legs[0].duration_in_traffic.value;

						$("#calc-it").fadeOut("fast", function() {
							$("#eta").text(Eta.text + " to " + localStorage.destinationAddress);
							$("#send-it").fadeIn("fast", function() {
								Eta.stopLoading();
							});
						});
					} else {
						console.log("Unable to calculate route.");
						return;
					}
				});
			} else {
				alert("Unable to geocode address.");
				return;
			}

		});
	});

	if(!navigator.geolocation) {
		alert("Your browser is not capable of geolocation.");
		return;
	}

	Eta.setOrigin = function(latLng, address) {
		Eta.origin = {};
		Eta.origin.coords = latLng;
		Eta.origin.address = address;
		$("#origin-address").val(Eta.origin.address);
		Eta.map.setCenter(Eta.origin.coords);
		Eta.map.setZoom(14);

		if (Eta.originMarker) {
			Eta.originMarker.setMap(null);
		}

		Eta.originMarker = new google.maps.Marker({
			animation: google.maps.Animation.DROP,
			position: Eta.origin.coords,
			map: Eta.map,
		});
	}

	Eta.reverseGeo = function(latLng) {
		var promise = $.Deferred();
		Eta.getGeocoder().geocode({'location': latLng}, function(results, status) {
			if (status === 'OK' && results[0]) {
				var addressParts = {}
				for(var i in results[0].address_components) {
					var part = results[0].address_components[i];
					addressParts[part.types[0]] = part.short_name;
				}
				var address = "";
				address += addressParts.street_number + " ";
				address += addressParts.route + " ";
				address += addressParts.locality + ", ";
				address += addressParts.administrative_area_level_1;
				promise.resolve(address);
			} else {
				promise.fail(status);
			}
		});
		return promise;
	}

	Eta.geoSuccess = function(position) {
		var latLng = {lat: position.coords.latitude, lng: position.coords.longitude};
		Eta.reverseGeo(latLng).done(function(address) {
			Eta.setOrigin(latLng, address);
			Eta.stopLoading();
		});
	}

	Eta.geoFail = function() {
		Eta.stopLoading();
		alert("Unable to determine your location.");
		return;
	}

	navigator.geolocation.getCurrentPosition(Eta.geoSuccess, Eta.geoFail);

	$("#origin-address").blur(function() {
		var address = $("#origin-address").val();
		Eta.getGeocoder().geocode( { address: address }, function (results, status) {
			if (status == "OK" && results[0]) {
				var latLng = results[0].geometry.location;
				Eta.setOrigin(latLng, address);
			}
		});
	});
});
