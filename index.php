<?php
session_start();
$_SESSION['secret'] = uniqid();
?>
<!DOCTYPE html>
<html>

<head>
   <meta charset='utf-8' />
   <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
   <title>산성비</title>
   <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
   <link rel="stylesheet" href="/stylesheets/style.css">
</head>

<body>
   <input type="hidden" id="secret" value="<?php echo $_SESSION['secret'] ?>" />
   <div class="title flow-text"><img class="logo" src="/images/title.png"><span id="titleText">한컴타자연습 (놀이마당 1)</span><button id="btnClose" class="right close-button">X</button></div>
   <div class="dashboard flow-text">
      <div class="stats"><span id="correct">정타:0</span><span id="wrong">오타:0</span><span id="accuracy">정확도:0%</span>
      </div>
      <div class="score">
         <span>점수:</span>
         <div id="score">10</div>
      </div>
      <div class="life-container"><span>pH:</span><span id="life"></span></div>
   </div>
   <canvas id="game"></canvas>
   <div class="footer">
      <div id="footer-input" data-input=""><input class="browser-default" id="gameInput" type="text" spellcheck="false" autofocus></div>
      <div class="footer-status flow-text">
         <div class="keyboard">한글-2</div>
         <div class="status"></div>
         <div id="elapsed">00:00</div>
      </div>
   </div>
   <div id="gameover-container" style="display:none">
      <div id="gameover">놀이가 끝났습니다.</div>
   </div>
   <script src="/javascripts/game.min.js"></script>
   <script src="//cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
</body>

</html>