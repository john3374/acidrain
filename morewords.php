<?php
session_start();
if (!$_SESSION['last_accessed'] || time() - $_SESSION['last_accessed'] > 10) {
  $con = new mysqli('remotemysql.com', 'tZYNDu6K6V', 'zdZg6Mr5Jh', 'tZYNDu6K6V');
  if ($con->connect_error) {
    die("Connection failed: " . $conn->connect_error);
  }
  $result = $con->query('SELECT idword FROM word ORDER BY RAND() LIMIT 10');
  if ($result->num_rows > 0) {
    // output data of each row
    while ($row = $result->fetch_assoc())
      $ret[] = $row['idword'];
    echo json_encode($ret);
  } else
    echo '[]';
  $_SESSION['last_accessed']  = time();
} else echo '';
