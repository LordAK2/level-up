const nav = document.querySelector('.nav-column');
const overlay = document.querySelector('.overlay');
const teachers = document.querySelector('#teachers');
const core = document.querySelector('#core');

document.querySelector('.but-nav').addEventListener("click", function(){
    nav.classList.add("nav2-column");
    overlay.classList.add("overlay2")
})

document.querySelector('.close-nav').addEventListener("click",function(){
    nav.classList.remove("nav2-column");
    overlay.classList.remove("overlay2");
})

document.querySelector(".overlay").addEventListener("click",function(){
    nav.classList.remove("nav2-column");
    overlay.classList.remove("overlay2");
})

document.querySelector("#teachers-link").addEventListener("click", function(){
    teachers.classList.remove("visible");
    core.classList.add("visible");
    day3.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#core-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.remove("visible");
    day3.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#day3-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    day3.classList.remove("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})