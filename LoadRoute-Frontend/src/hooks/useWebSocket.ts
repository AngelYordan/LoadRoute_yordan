import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BASE_URL } from '@/config/constants';

interface UseWebSocketOptions {
  topic: string;
  onMessage: (message: any) => void;
}

export function useWebSocket({ topic, onMessage }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const socket = new SockJS(`${BASE_URL}/ws`);
    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => {
        // console.log(str); // Descomentar para ver logs de STOMP
      },
      onConnect: () => {
        stompClient.subscribe(topic, (msg) => {
          try {
            const body = JSON.parse(msg.body);
            onMessage(body);
          } catch (e) {
            onMessage(msg.body);
          }
        });
      },
    });

    stompClient.activate();
    clientRef.current = stompClient;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [topic, onMessage]);
}
