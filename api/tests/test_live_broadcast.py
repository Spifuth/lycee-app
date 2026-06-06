import asyncio

from app.live_broadcast import LiveBroadcaster, LiveSnapshot


async def test_subscribe_receives_published_snapshot():
    b = LiveBroadcaster()
    q = b.subscribe()
    snap = LiveSnapshot(shared={"state": "lobby"})
    b.publish(snap)
    got = await asyncio.wait_for(q.get(), timeout=1.0)
    assert got.shared["state"] == "lobby"
    b.unsubscribe(q)


async def test_unsubscribe_removes_queue():
    b = LiveBroadcaster()
    q = b.subscribe()
    assert b.subscriber_count == 1
    b.unsubscribe(q)
    assert b.subscriber_count == 0


async def test_publish_coalesces_when_queue_full():
    b = LiveBroadcaster(queue_maxsize=1)
    q = b.subscribe()
    b.publish(LiveSnapshot(shared={"n": 1}))
    b.publish(LiveSnapshot(shared={"n": 2}))  # must not raise; keeps latest
    got = await asyncio.wait_for(q.get(), timeout=1.0)
    assert got.shared["n"] == 2
    b.unsubscribe(q)
