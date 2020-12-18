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
  $con->close();
}
