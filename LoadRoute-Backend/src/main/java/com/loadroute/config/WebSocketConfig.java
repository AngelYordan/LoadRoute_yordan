package com.loadroute.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Habilitar un broker simple en memoria para enviar mensajes al cliente en destinos con prefijo /topic
        config.enableSimpleBroker("/topic");
        // Prefijo para mensajes enviados desde el cliente al servidor (si hubiera)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // El cliente se conectará a /ws
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // Permitir CORS
                .withSockJS(); // Fallback para navegadores que no soporten WS puro
    }
}
