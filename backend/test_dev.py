"""Test livestream con blinkpy dev (0.26.0b0) — nuovo BlinkLiveStream + OAuth v2."""
import asyncio
import socket
from time import time
import blinkpy_patches
from blinkpy.blinkpy import Blink
from blinkpy.auth import Auth
from blinkpy.helpers.util import json_load

blinkpy_patches.apply_patches()


async def main():
    creds = await json_load("blink_credentials.json")
    blink = Blink()
    blink.auth = Auth(creds, no_prompt=True)
    started = await blink.start()
    print("Started:", started, "| Available:", blink.available)

    if not blink.available:
        print("Sessione non valida — serve nuovo login con 2FA (OAuth v2).")
        return

    cam = blink.cameras["Cucina"]
    print(f"Camera: {cam.name} serial={cam.serial} type={cam.product_type}")

    # init_livestream restituisce un BlinkLiveStream (nuovo modulo dev)
    livestream = await cam.init_livestream()
    print("LiveStream creato, avvio proxy TCP locale...")

    await livestream.start()
    local_url = livestream.url
    print(f"Proxy locale: {local_url}")

    # Avvia il feed (auth + recv + send + poll) in background
    feed_task = asyncio.create_task(livestream.feed())

    # Aspetta che il proxy abbia dati, poi connettiti come client
    await asyncio.sleep(2)

    sockname = livestream.socket.getsockname()
    host, port = sockname[0], sockname[1]
    print(f"Connessione al proxy {host}:{port}...")

    loop = asyncio.get_event_loop()
    client = await loop.run_in_executor(None, socket.create_connection, (host, port))
    client.settimeout(15)

    total = 0
    start = time()
    try:
        while time() - start < 15:
            try:
                data = await loop.run_in_executor(None, client.recv, 4096)
            except socket.timeout:
                print("timeout lettura")
                break
            if not data:
                print("proxy chiuso")
                break
            total += len(data)
            if total <= 8192:
                # Cerca il sync byte MPEG-TS 0x47
                has_sync = b"\x47" in data[:10]
                print(f"  +{len(data)} (tot {total}) first={data[:8].hex()} ts_sync={has_sync}")
            elif total % 50000 < 4096:
                print(f"  ... tot {total}")
            if total > 200_000:
                print(">>> 200KB di VIDEO ricevuti — FUNZIONA!!! <<<")
                break
    finally:
        client.close()
        feed_task.cancel()
        try:
            await feed_task
        except asyncio.CancelledError:
            pass
        livestream.stop()

    print(f"TOTALE: {total} bytes")


if __name__ == "__main__":
    asyncio.run(main())
