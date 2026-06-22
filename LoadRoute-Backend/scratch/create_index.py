import mysql.connector
import time

try:
    print("Connecting to DB...")
    conn = mysql.connector.connect(
        host="loadroute.cfg69dqi6z95.us-east-1.rds.amazonaws.com",
        user="admin",
        password="Admindp1.",
        database="loadroute"
    )
    cursor = conn.cursor()
    print("Creating index idx_fecha_creacion on envios(fecha_creacion)...")
    t0 = time.time()
    cursor.execute("CREATE INDEX idx_fecha_creacion ON envios(fecha_creacion)")
    conn.commit()
    t1 = time.time()
    print(f"Index created successfully in {t1 - t0:.2f} seconds!")
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
