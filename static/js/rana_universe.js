// static/js/rana_universe.js
// Here i will keep all the necessary js things 
// These are for own later logics to change

document.addEventListener("DOMContentLoaded", function () {
    var navbar = document.querySelector(".navbar");
    if (!navbar) return;
    // If there's no navbar, stop running the script right here!

    var currentPath = window.location.pathname;
    var navLinks = navbar.querySelectorAll(".navbar-nav a.nav-link, .navbar-nav a.btn");

    navLinks.forEach(function (link) {
        var linkPath = link.getAttribute("href");

        if (linkPath === currentPath) {
            link.classList.add("border", "border-primary", "border-3");
        } else {
            link.classList.remove("border", "border-primary", "border-3");
        }
    });
});