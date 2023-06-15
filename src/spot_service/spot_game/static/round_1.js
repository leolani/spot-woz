    let score = 0;
    let shown = 0;
    $(document).ready(function() {
        function fadeOut(){
            $('.hide').css('visibility','hidden')
            $('.show').show()
        }
        setTimeout(fadeOut, 10000);
        $('select').change(function() {
            $(this).hide();
            // let character = $(this).attr('name');
            // $('#'+character).show();
            let checkmark = $(this).attr('name');
            $('#'+checkmark).show();
            let answer = $(this).val();
            let trueAnswer = $(this).attr('class');
            if(answer === trueAnswer) {
                score += 1;
                $('#score').val(score);
            }
        });
        $('#show').click(function(){
            $('.hide').css('visibility','visible');
            $(this).hide();
            shown += 1;
            $('#shown').val(shown);
            setTimeout(fadeOut, 10000);
        });
    });