import os
import asyncio
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.config import DOCS_DIR

class DocumentationHandler(FileSystemEventHandler):
    def __init__(self, loop, on_change_coro):
        self.loop = loop
        self.on_change_coro = on_change_coro

    def process_event(self, event, event_type: str):
        if event.is_directory:
            return
            
        file_path = event.src_path
        # Ignore temporary or hidden files (like .DS_Store or swap files)
        if Path(file_path).name.startswith('.') or not file_path.endswith('.md'):
            return

        print(f"[FileWatcher] Event detected: {event_type} on {file_path}")
        # Dispatch to the main asyncio loop safely from the watchdog thread
        asyncio.run_coroutine_threadsafe(
            self.on_change_coro(file_path, event_type),
            self.loop
        )

    def on_modified(self, event):
        self.process_event(event, "change")

    def on_created(self, event):
        self.process_event(event, "add")

    def on_deleted(self, event):
        self.process_event(event, "unlink")

class DocWatcher:
    def __init__(self, on_change_coro):
        self.on_change_coro = on_change_coro
        self.observer = None

    def start(self):
        loop = asyncio.get_running_loop()
        handler = DocumentationHandler(loop, self.on_change_coro)
        
        # Ensure docs directory exists
        os.makedirs(DOCS_DIR, exist_ok=True)
        
        self.observer = Observer()
        self.observer.schedule(handler, DOCS_DIR, recursive=True)
        self.observer.start()
        print(f"[FileWatcher] Observer started on directory: {DOCS_DIR}")

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            print("[FileWatcher] Observer stopped")
