    // let score = 0;
    // let shown = 0;


$(document).ready(function() {
    let restPath = window.location.pathname.split('/').slice(0, -2).join('/');
    console.log(restPath);

    $('select').change(function() {
        $(this).hide();
        let checkmark = $(this).attr('name');
        $('#' + checkmark).show();
        console.log("XXX practice select", restPath, checkmark, $(this).val());
        checkStatus();
    });
    let restURL = window.location.pathname.split('/spot')[0] + "/chatui/chat";
    function checkStatus() {$.get(restURL + "/" + "practice/continue").done(
        function ( data ) {
            if(data === "true"){
                $('#submit').show()}
            else{
                setTimeout(checkStatus, 1000);
            }
        }
    ).fail(
        function ( data ) {
            console.log("hello", data );
            $('#submit').show();
        }
    )}
});