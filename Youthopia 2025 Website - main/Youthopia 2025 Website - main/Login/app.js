const nav = document.querySelector('.nav-column');
const overlay = document.querySelector('.overlay');
const teachers = document.querySelector('#teachers');
const core = document.querySelector('#core');
const department = document.querySelector('#department');
const web = document.querySelector('#web');
const tech = document.querySelector('#tech');
const events = document.querySelector('#event');
const executive = document.querySelector('#executive');

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
    department.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#core-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.remove("visible");
    department.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#department-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    department.classList.remove("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#web-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    department.classList.add("visible");
    web.classList.remove("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#tech-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    department.classList.add("visible");
    web.classList.add("visible");
    tech.classList.remove("visible");
    events.classList.add("visible");
    executive.classList.add("visible");
})
document.querySelector("#event-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    department.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.remove("visible");
    executive.classList.add("visible");
})
document.querySelector("#executive-link").addEventListener("click", function(){
    teachers.classList.add("visible");
    core.classList.add("visible");
    department.classList.add("visible");
    web.classList.add("visible");
    tech.classList.add("visible");
    events.classList.add("visible");
    executive.classList.remove  ("visible");
})