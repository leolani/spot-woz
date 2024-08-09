const searchParams = new URLSearchParams(window.location.search);

$(document).ready(function (){
    $(window).on("message onmessage", function(event) {
        if (event.originalEvent.data === "requestHref") {
            event.originalEvent.source.postMessage($(location).attr("href"), event.originalEvent.origin);
        }
    });

    if(searchParams.has("total_score")) {
        let score = searchParams.get("total_score");
        score = parseInt(score);
        score = score*2;
        $('#score').text(score);
    }

    if (searchParams.has("shown")) {
        let shown = searchParams.get("shown");
        $('#shown').text(`${shown} keer`);
    }

    $('#questions').click(function (){
        $('#qualtrics').hide();
        $('#next').show();
    });
})