#ifndef BATTERY_H
#define BATTERY_H

#include <Arduino.h>
#include "HardwareConfig.h"

// ============================================================================
// BATTERY MONITOR (Optimized for 1S, 2S, 3S, 4S Li-ion / LiPo)
// ============================================================================

#ifndef BATTERY_CELLS
#define BATTERY_CELLS 2
#endif

#ifndef BATTERY_DIVIDER_RATIO
#define BATTERY_DIVIDER_RATIO 3.0f
#endif

class BatteryManager {
private:
  uint8_t cellCount;
  float dividerRatio;
  float cellFullV;
  float cellEmptyV;
  float smoothedVolts;
  bool isInitialized;

  void updateThresholds(uint8_t cells) {
    if (cells < 1) cells = 1;
    if (cells > 4) cells = 4;
    cellCount = cells;
  }

public:
  BatteryManager(uint8_t cells = BATTERY_CELLS, float divider = BATTERY_DIVIDER_RATIO)
    : cellCount(cells),
      dividerRatio(divider),
      cellFullV(4.20f),
      cellEmptyV(3.20f),
      smoothedVolts(0.0f),
      isInitialized(false) {
    if (cellCount > 4) cellCount = 4;
  }

  void begin() {
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);
    pinMode(BATTERY_PIN, INPUT);
    isInitialized = true;
  }

  void setCellCount(uint8_t cells) {
    updateThresholds(cells);
    smoothedVolts = 0.0f;
  }

  uint8_t getCellCount() const {
    return cellCount;
  }

  void setDividerRatio(float ratio) {
    dividerRatio = ratio;
  }

  /**
   * Auto-detect cell count based on raw voltage measurement (1S, 2S, 3S, 4S)
   */
  uint8_t detectCellCount(float rawVoltage) {
    if (rawVoltage > 13.0f) return 4; // 4S: 12.8V - 16.8V
    if (rawVoltage > 9.0f)  return 3; // 3S:  9.6V - 12.6V
    if (rawVoltage > 5.0f)  return 2; // 2S:  6.4V -  8.4V
    return 1;                         // 1S:  3.2V -  4.2V
  }

  /**
   * Read filtered battery voltage and percentage.
   * Returns: 0 - 100 percentage, or -1 if unwired / USB powered.
   */
  int read(float &outVolts) {
    if (!isInitialized) begin();

    // 1. Oversample 8 readings using calibrated millivolts
    uint32_t mvSum = 0;
    for (int i = 0; i < 8; i++) {
      mvSum += analogReadMilliVolts(BATTERY_PIN);
    }
    float pinMv = mvSum / 8.0f;

    // Minimum raw pin voltage to be considered a real connected battery (~500 mV)
    if (pinMv < 500.0f) {
      outVolts = 0.0f;
      smoothedVolts = 0.0f;
      return -1; // Unwired or USB powered
    }

    // 2. Calculate actual pack voltage
    float instantVolts = (pinMv / 1000.0f) * dividerRatio;

    // Auto-detect cell count if configured as 0
    uint8_t activeCells = cellCount;
    if (activeCells == 0) {
      activeCells = detectCellCount(instantVolts);
    }

    float fullV  = activeCells * cellFullV;
    float emptyV = activeCells * cellEmptyV;
    float minRealV = activeCells * 2.80f; // Below 2.8V/cell is unwired or critical drop

    if (instantVolts < minRealV) {
      outVolts = 0.0f;
      smoothedVolts = 0.0f;
      return -1; // Reports "NO BATTERY / USB POWERED" to UI
    }

    // 3. Exponential Moving Average (EMA) smoothing (90% history, 10% instant)
    if (smoothedVolts < (activeCells * 2.5f)) {
      smoothedVolts = instantVolts; // Seed immediately on first valid reading
    } else {
      smoothedVolts = (smoothedVolts * 0.90f) + (instantVolts * 0.10f);
    }

    outVolts = smoothedVolts;

    // 4. Calculate percentage constrained between 0% and 100%
    float pct = ((smoothedVolts - emptyV) / (fullV - emptyV)) * 100.0f;
    return (int)constrain(pct, 0.0f, 100.0f);
  }
};

// Global Battery Manager instance defined in ESP-RC-Sketch.ino
extern BatteryManager batteryMonitor;

// Legacy / Helper wrapper for direct drop-in compatibility
inline int getBatteryLevel(float &outVolts) {
  return batteryMonitor.read(outVolts);
}

#endif // BATTERY_H
