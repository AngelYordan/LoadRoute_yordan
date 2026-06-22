import mysql.connector

try:
    conn = mysql.connector.connect(
        host="loadroute.cfg69dqi6z95.us-east-1.rds.amazonaws.com",
        user="admin",
        password="Admindp1.",
        database="loadroute"
    )
    cursor = conn.cursor()
    query = """
    EXPLAIN select
        ee1_0.id,
        ee1_0.cantidad_maletas,
        ee1_0.clave_compuesta,
        ee1_0.cliente_id,
        ee1_0.destino_id,
        ee1_0.fecha_creacion,
        ee1_0.origen_id
    from
        envios ee1_0
    where
        ee1_0.fecha_creacion between '2028-03-20 00:00:00' and '2028-03-23 00:00:00'
    """
    cursor.execute(query)
    print("--- EXPLAIN SIMPLE ---")
    headers = [i[0] for i in cursor.description]
    print(headers)
    for row in cursor.fetchall():
        print(row)
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)
