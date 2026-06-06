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


async def test_ensure_poller_starts_when_none():
    b = LiveBroadcaster()

    async def noop():
        await asyncio.sleep(100)

    b.ensure_poller(noop)
    assert b._poller is not None and not b._poller.done()
    b._poller.cancel()


async def test_ensure_poller_restarts_after_task_done():
    b = LiveBroadcaster()

    async def die():
        return

    b.ensure_poller(die)
    await asyncio.sleep(0)  # let die() complete
    assert b._poller.done()

    async def noop():
        await asyncio.sleep(100)

    b.ensure_poller(noop)  # done task → should start a fresh one
    assert not b._poller.done()
    b._poller.cancel()


async def test_maybe_stop_keeps_poller_while_subscribers_remain():
    b = LiveBroadcaster()

    async def noop():
        await asyncio.sleep(100)

    q1 = b.subscribe()
    q2 = b.subscribe()
    b.ensure_poller(noop)
    b.unsubscribe(q1)
    b.maybe_stop_poller()  # q2 still subscribed
    assert b._poller is not None and not b._poller.done()
    b._poller.cancel()
    b.unsubscribe(q2)


async def test_maybe_stop_cancels_and_clears_when_last_leaves():
    b = LiveBroadcaster()

    async def noop():
        await asyncio.sleep(100)

    q = b.subscribe()
    b.ensure_poller(noop)
    task = b._poller
    b.unsubscribe(q)
    b.maybe_stop_poller()
    # Reference is cleared immediately so a reconnect can restart the poller.
    assert b._poller is None
    await asyncio.sleep(0)  # let the cancellation propagate
    assert task.cancelled()
