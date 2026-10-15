import threading

from foodcreator.core.errors import CancelledError


class CancelToken:
    """Sinal de cancelamento compartilhado entre a interface e o trabalho em segundo plano."""

    def __init__(self) -> None:
        self._event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()

    def raise_if_cancelled(self) -> None:
        if self._event.is_set():
            raise CancelledError()
