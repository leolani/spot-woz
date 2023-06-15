let score = 0;
    let shown = 0;
    const searchParams = new URLSearchParams(window.location.search);
    let total = 0;

    if(searchParams.has('total_score')){
        total = searchParams.get('total_score');
        total = parseInt(total);
    }

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
                total += 1;
                $('#score').val(score);
                $('#total').val(total)
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