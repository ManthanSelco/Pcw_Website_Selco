$('.hamburger-wrapper').on('click', function (e) {
    e.preventDefault(); // prevent unwanted behavior (like jumping)
    $(this).toggleClass('active');
    $('.hamburgercontent').toggleClass('active');
    $('body').toggleClass('nooverflow');
  });
  
   $('.mobile-buttons').on('click', function (e) {
    $('.hamburger-wrapper').removeClass('active');
    $('.hamburgercontent').removeClass('active');
    $('body').removeClass('nooverflow');
  });
