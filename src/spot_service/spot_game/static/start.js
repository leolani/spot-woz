$(document).ready(function (){
        $('#showfaces').click(function (){
            $('.introduction').show();
            $('#continue').hide();
            $('#show').hide();
            checkStatus();
        })
        let restURL = window.location.pathname.split('/spot')[0] + "/chatui/chat";
        function checkStatus() {$.get(restURL + "/" + "introduction/continue").done(
            function ( data ) {
                if(data === "true"){
                    $('#continue').show()}
                else{
                    setTimeout(checkStatus, 1000);
                }

            }
        ).fail(
            function ( data ) {
                console.log("hello", data );
                $('#continue').show();
            }
        )}
    })