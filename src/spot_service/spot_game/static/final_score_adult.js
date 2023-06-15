const searchParams = new URLSearchParams(window.location.search);

$(document).ready(function (){
    if(searchParams.has("total_score")){
        let score = searchParams.get("total_score");
        $('#score').text(score);
    }
    if (searchParams.has("shown")){
        let shown = searchParams.get("shown");
        $('#shown').text(`${shown} keer`)
    }})