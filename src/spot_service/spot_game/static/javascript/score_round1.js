const searchParams = new URLSearchParams(window.location.search);

$(document).ready(function() {
    if(searchParams.has("score")){
        let score = searchParams.get("score");
        $('#score').text(score)
        $('#total_score').val(score)
        console.log(score)
    }
    if (searchParams.has("shown")){
        let shown = searchParams.get("shown");
        $('#shown').text(`${shown} keer`)
    }
    $('#questions').click(function (){
        $('#qualtrics').hide();
        $('#next').show();
    })})