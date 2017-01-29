#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <Thread.h>
#include <ThreadController.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#include "config.h";

#define DHTTYPE DHT11

#define LED_PWR D0
#define LED_NET D1
#define LED_ACT D2

#define BUS_DHT D5

ESP8266WiFiMulti wifiMulti;
WiFiClient client;

PubSubClient mqtt;

DHT dht(BUS_DHT, DHTTYPE);
ThreadController controller = ThreadController();
Thread climateThread = Thread();

void setup() {
  Serial.begin(9600);
  delay(10);
  Serial.println("Serial intialization done");

  Serial.print("Initializing pins...");
  pinMode(LED_PWR, OUTPUT);
  pinMode(LED_NET, OUTPUT);
  pinMode(LED_ACT, OUTPUT);
  Serial.println(" done");

  on_led(LED_PWR);
  on_led(LED_NET);
  on_led(LED_ACT);
  delay(1000);
  blink(LED_PWR);
  blink(LED_PWR);
  blink(LED_PWR);
  delay(1000);
  off_led(LED_NET);
  off_led(LED_ACT);
  
  Serial.println();
  Serial.println();

  // We start by connecting to a WiFi network
  wifiMulti.addAP(WLAN_SSID, WLAN_PASS);

  wifiConnect();

  mqtt.setClient(client); //set client for mqqt (ethernet)
  mqtt.setServer(MQTT_SERVER, 1883); // set server for mqqt(raspberry)
  mqtt.setCallback(mqttCallback); // set callback for subscripting

  mqttConnect();

  climateThread.onRun(climateProbeValues);
  climateThread.setInterval(60000);

  controller.add(&climateThread);

  dht.begin();

  blink(LED_ACT);
  blink(LED_ACT);
  blink(LED_ACT);
  delay(1000);
  
  Serial.println();
  Serial.println();
}

void loop() {
  if (wifiMulti.run() != WL_CONNECTED) {
    wifiConnect();
  }
  
  if (!mqtt.connected())
  {
    mqttConnect();
  }
  
  controller.run();
  mqtt.loop();
}

void wifiConnect() {
  Serial.print("Connecting to '");
  Serial.print(WLAN_SSID);
  Serial.print("' .");
  off_led(LED_NET);
  
  while(wifiMulti.run() != WL_CONNECTED) {
      blink(LED_PWR);
      blink(LED_NET);
      Serial.print(".");
      delay(500);
  }

  Serial.println(" connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  on_led(LED_PWR);
  on_led(LED_NET);
  delay(1000);
}

void mqttConnect() {
  Serial.print("Connecting to MQTT server as '");
  Serial.print(MQTT_ID);
  Serial.print("' ");
  off_led(LED_NET);
  
  do {
    mqtt.connect(MQTT_ID);
    blink(LED_NET);
    blink(LED_NET);
    Serial.print(".");
    delay(500);
  } while (!mqtt.connected());
  
  Serial.println(" connected.");

  blink(LED_NET);
  blink(LED_NET);

  //mqtt.subscribe(SUB_TOPIC);

  on_led(LED_NET);
  delay(1000);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  blink(LED_ACT);
  blink(LED_ACT);

  Serial.print("Handling callback for ");
  Serial.println(String(topic));
}

void climateProbeValues() {
    
  blink(LED_ACT);
  blink(LED_ACT);
  
  Serial.print("Requesting climate ... ");
  float h = dht.readHumidity();
  Serial.print(h);
  Serial.print(" ");
  float t = dht.readTemperature();
  Serial.print(t);
  Serial.print(" ");
  
  // Check if any reads failed and exit early (to try again).
  if (isnan(h) || isnan(t)) {
    Serial.println("failed!");
    return;
  }
  // Compute heat index in Celsius (isFahreheit = false)
  float hic = dht.computeHeatIndex(t, h, false);
  Serial.print(hic);
  Serial.print(" ");

  float gas = analogRead(A0) / 10.24;

  Serial.print(gas);
  Serial.print(" ");

  Serial.println("done");
  
  StaticJsonBuffer<200> jsonBuffer;
  JsonObject& root = jsonBuffer.createObject();
  root["temperature"] = t;
  root["humidity"] = h;
  root["heat-index"] = hic;
  root["harmful-gases"] = gas;
  
  char buffer[256];
  root.printTo(buffer, sizeof(buffer));
  mqtt.publish(PUB_TOPIC, buffer); 
    
  blink(LED_ACT);
  blink(LED_ACT);
}

void on_led(int pin) {
  digitalWrite(pin, HIGH);
}

void off_led(int pin) {
  digitalWrite(pin, LOW);
}

void blink(int pin) {
  on_led(pin);
  delay(200);
  off_led(pin);
  delay(100);
}
