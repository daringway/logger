const encoder = new TextEncoder();

interface QueueObject {
  size: number;
  item: string;
}

class OptimizedQueue {
  private enqueueStack: QueueObject[];
  private dequeueStack: QueueObject[];
  private totalByteLength: number;

  constructor() {
    this.enqueueStack = [];
    this.dequeueStack = [];
    this.totalByteLength = 0;
  }

  // Add an element to the end of the queue
  enqueue(item: string): void {
    const size = encoder.encode(item).length;
    this.totalByteLength += size;
    this.enqueueStack.push({ item, size });
  }

  // Remove an element from the front of the queue
  dequeue(): QueueObject | null {
    if (this.dequeueStack.length === 0) {
      if (this.enqueueStack.length === 0) {
        return null;
      }
      // Move all elements from enqueueStack to dequeueStack
      while (this.enqueueStack.length > 0) {
        this.dequeueStack.push(this.enqueueStack.pop() as QueueObject); // Ensure non-null value
      }
    }
    const obj = this.dequeueStack.pop(); // Ensure non-null value
    if (obj) {
      this.totalByteLength -= obj.size;
      return obj;
    }
    return null;
  }

  requeue(item: QueueObject): void {
    this.totalByteLength += item.size;
    this.dequeueStack.push(item);
  }

  push(item: string): void {
    const size = encoder.encode(item).length;
    this.totalByteLength += size;
    this.dequeueStack.push({ item, size });
  }

  // Check if the queue is empty
  isEmpty(): boolean {
    return this.enqueueStack.length === 0 && this.dequeueStack.length === 0;
  }

  byteSize(): number {
    return this.totalByteLength;
  }
}

export default OptimizedQueue;
