var Webflow = Webflow || [];   Webflow.push(function() {     $.get('/snippets/heroBannerv2.html', function(data) {       $('#heroContent').append(data);     });   });
