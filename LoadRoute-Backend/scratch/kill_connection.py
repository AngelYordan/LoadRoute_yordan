import mysql.connector

try:
    conn = mysql.connector.connect(
        host="loadroute.cfg69dqi6z95.us-east-1.rds.amazonaws.com",
        user="admin",
        password="Admindp1.",
        database="loadroute"
    )
    cursor = conn.cursor()
    print("Killing connection 28058...")
    cursor.execute("KILL 28058")
    print("Connection killed!")
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
