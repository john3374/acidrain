<?php
session_start();
if (!isset($_SESSION['last_accessed']) || time() - $_SESSION['last_accessed'] > 10) {
  $con = new mysqli('localhost', 'tZYNDu6K6V', 'bOKE6ONe2IHequ13jE54BAyid8pez1', 'kkong');
  if ($con->connect_error) {
    die("Connection failed: " . $con->connect_error);
  }
  $result = $con->query('SELECT word FROM acidrain_word ORDER BY RAND() LIMIT 10');
  if ($result->num_rows > 0) {
    // output data of each row
    while ($row = $result->fetch_assoc())
      $ret[] = $row['word'];
    echo json_encode($ret);
  } else
    echo '[]';
  $_SESSION['last_accessed']  = time();
} else echo '';
