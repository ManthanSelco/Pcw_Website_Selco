// init controller
	var controller = new ScrollMagic.Controller();
  
   // build scenes
			new ScrollMagic.Scene({
								triggerElement: '#brain-section', // y value not modified, so we can use element as trigger as well
								offset: 50,												 // start a little later
								triggerHook: 0.9,
                reverse: true, //
							})
							.setClassToggle('#brain-section', "visible") // add class toggle
							//.addIndicators() // add indicators 
							.addTo(controller);
              
              
                 // build scenes
			new ScrollMagic.Scene({
								triggerElement: '#button-line', // y value not modified, so we can use element as trigger as well
								offset: 200,												 // start a little later
								triggerHook: 0.9,
                reverse: true, //
							})
							.setClassToggle('#brain-section', "visible-line") // add class toggle
							//.addIndicators() // add indicators 
							.addTo(controller);
              
       // build scenes
			new ScrollMagic.Scene({
								triggerElement: '#long-image', // y value not modified, so we can use element as trigger as well
								offset: 200,												 // start a little later
								triggerHook: 0.9,
                reverse: true, //
							})
							.setClassToggle('#long-image', "visible-line") // add class toggle
							//.addIndicators() // add indicators 
							.addTo(controller);
		       // build scenes
			new ScrollMagic.Scene({
								triggerElement: '#joinBrain', // y value not modified, so we can use element as trigger as well
								offset: 200,												 // start a little later
								triggerHook: 0.9,
                reverse: true, //
							})
							.setClassToggle('#joinBrain', "visible-line") // add class toggle
							//.addIndicators() // add indicators 
							.addTo(controller);
