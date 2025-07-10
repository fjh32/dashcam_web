// let downloadMode = false;

// window.onload = function(){
//     updateDownloadSlider();
//     slideOne();
//     slideTwo();
// }
// let sliderOne = document.getElementById("downloadSlider1");
// let sliderTwo = document.getElementById("downloadSlider2");
// let displayValOne = document.getElementById("range1");
// let displayValTwo = document.getElementById("range2");
// let minGap = 0;
// let sliderTrack = document.querySelector(".slider-track");
// let sliderMaxValue = document.getElementById("downloadSlider1").max;

// // document.addEventListener('DOMContentLoaded', function () {
// // });

// function updateDownloadSlider() {
//         fetch('/segment_count')
//             .then(response => response.json())
//             .then(data => {
//                 sliderOne.max = data.latest_segment;
//                 sliderTwo.max = data.latest_segment;
//                 // sliderMaxValue = data.latest_segment;

//                 // slideOne();
//                 // slideTwo();
//             });
//     }

// function slideOne(){
//     if(parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap){
//         sliderOne.value = parseInt(sliderTwo.value) - minGap;
//     }
//     displayValOne.textContent = sliderOne.value;
//     fillColor();
// }
// function slideTwo(){
//     if(parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap){
//         sliderTwo.value = parseInt(sliderOne.value) + minGap;
//     }
//     displayValTwo.textContent = sliderTwo.value;
//     fillColor();
// }
// function fillColor(){
//     percent1 = (sliderOne.value / sliderMaxValue) * 100;
//     percent2 = (sliderTwo.value / sliderMaxValue) * 100;
//     sliderTrack.style.background = `linear-gradient(to right, #dadae5 ${percent1}% , #3264fe ${percent1}% , #3264fe ${percent2}%, #dadae5 ${percent2}%)`;
// }























window.onload = function(){
    slideOne();
    slideTwo();
}

let sliderOne = document.getElementById("slider-1");
let sliderTwo = document.getElementById("slider-2");
let displayValOne = document.getElementById("range1");
let displayValTwo = document.getElementById("range2");
let minGap = 0;
let sliderTrack = document.querySelector(".slider-track");
let sliderMaxValue = parseInt(document.getElementById("slider-1").max);

function slideOne(){
    if(parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap){
        sliderOne.value = parseInt(sliderTwo.value) - minGap;
    }
    displayValOne.textContent = sliderOne.value;
    fillColor();
}
function slideTwo(){
    if(parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap){
        sliderTwo.value = parseInt(sliderOne.value) + minGap;
    }
    displayValTwo.textContent = sliderTwo.value;
    fillColor();
}
function fillColor(){
    let max = parseInt(sliderOne.max);
    let percent1 = (parseInt(sliderOne.value) / max) * 100;
    let percent2 = (parseInt(sliderTwo.value) / max) * 100;
    sliderTrack.style.background = `linear-gradient(to right, #dadae5 ${percent1}%, #3264fe ${percent1}%, #3264fe ${percent2}%, #dadae5 ${percent2}%)`;
}
