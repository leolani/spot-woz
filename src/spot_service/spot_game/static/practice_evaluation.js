const searchParams = new URLSearchParams(window.location.search);

$(document).ready(function() {
    if(searchParams.has("score")){
        let score = searchParams.get("score");
        $('#score').text(score)
    }
    if (searchParams.has("shown")){
        let shown = searchParams.get("shown");
        $('#shown').text(`${shown} keer`)
    }})