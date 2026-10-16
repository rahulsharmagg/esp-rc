#ifndef HARDWARE_CONFIG_H
#define HARDWARE_CONFIG_H

// ============================================================================
// HARDWARE PIN DEFINITIONS
// ============================================================================

// L298N dual motor driver
#define ENA 14
#define IN1 27
#define IN2 26
#define ENB 25
#define IN3 33
#define IN4 32

// Input sensors
#define BATTERY_PIN           36    // ADC1 GPIO 36 (VP)
#define BATTERY_CELLS         2     // Supported: 1 (1S), 2 (2S), 3 (3S), 4 (4S) [or 0 for AUTO]
#define BATTERY_DIVIDER_RATIO 3.0f  // Resistor divider ratio (e.g. 20k:10k divider = 3.0)
#define IR_LEFT               34
#define IR_RIGHT              35
#define IR_OBSTACLE_STATE     LOW

// Ultrasonic + servo
#define SERVO_PIN 5
#define TRIG_PIN  18
#define ECHO_PIN  19    // via voltage divider

// Lights, horn, status
#define HEADLIGHT_LEFT_PIN  22
#define HEADLIGHT_RIGHT_PIN 23
#define BUZZER_PIN          21
#define STATUS_LED_PIN      2   // Primary status LED (BLE connection)
#define STATUS_LED_2_PIN    4   // Secondary status LED (Wi-Fi scan, connection, OTA update)
#define WIFI_STATUS_LED_PIN STATUS_LED_2_PIN

#endif // HARDWARE_CONFIG_H
