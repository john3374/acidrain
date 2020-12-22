<?php
session_start();
if ($_SESSION['secret'] && $_SERVER["REQUEST_METHOD"] == "POST") {
  $con = new mysqli('localhost', 'tZYNDu6K6V', 'bOKE6ONe2IHequ13jE54BAyid8pez1', 'kkong');
  if ($con->connect_error) {
    die("Connection failed: " . $conn->connect_error);
  }
  $stmt = $con->prepare('insert into acidrain_record (name, correct, wrong, score, level, time) values(?,?,?,?,?,?)');
  $stmt->bind_param('siiiii', $name, $correct, $wrong, $score, $level, $time);
  $name = $_SESSION['secret']; // $_POST['name'];
  $correct = $_POST['correct'];
  $wrong = $_POST['wrong'];
  $score = $_POST['score'];
  $time = $_POST['time'];
  $level = $_POST['level'];
  $stmt->execute();
  $stmt->close();
  $_SESSION['secret'] = uniqid();
  $result = $con->query('SELECT level, score, created FROM acidrain_record order by score desc limit 10');
  if ($result->num_rows > 0) {
    // output data of each row
    while ($row = $result->fetch_assoc())
      $ret[] = $row;
    echo json_encode($ret);
  } else
    echo '[]';
  $con->close();
}
