#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <Thread.h>
#include <ThreadController.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include "config.ino"

#define LED_PWR D0
#define LED_NET D1
#define LED_ACT D2

#define BUS_ONE_WIRE D3
#define BUS_RELAY D4

ESP8266WiFiMulti wifiMulti;
WiFiClient client;
PubSubClient mqtt;

OneWire oneWire(BUS_ONE_WIRE);
DallasTemperature sensors(&oneWire);

ThreadController controller = ThreadController();
Thread thermThread = Thread();

void setup() {
  Serial.begin(9600);
  delay(10);
  Serial.println("Serial intialization done");

  Serial.print("Initializing pins...");
  pinMode(LED_PWR, OUTPUT);
  pinMode(LED_NET, OUTPUT);
  pinMode(LED_ACT, OUTPUT);
  pinMode(BUS_RELAY, OUTPUT);
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

  thermThread.onRun(thermProbeValues);
  thermThread.setInterval(60000);

  controller.add(&thermThread);

  Serial.print("Activating heater ...");
  digitalWrite(BUS_RELAY, LOW);

  DynamicJsonBuffer jsonBuffer;
  JsonObject& state = jsonBuffer.createObject();
  state["active"] = true;
  thermPublish(state);
  Serial.println(" done");

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

  mqtt.subscribe(SUB_TOPIC);

  on_led(LED_NET);
  delay(1000);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Handling callback for ");
  Serial.println(String(topic));
  if (String(topic) == SUB_TOPIC) {
    thermUpdateRelay(payload);
  }
  
  blink(LED_ACT);
}

void thermPublish(JsonObject& root) {
  char buffer[256];
  root.printTo(buffer, sizeof(buffer));
  mqtt.publish(PUB_TOPIC, buffer);
}

void thermUpdateRelay(byte* payload) {
  DynamicJsonBuffer jsonBuffer;
  JsonObject& root = jsonBuffer.parseObject((char*)payload);
  
  bool value = root["active"];
  digitalWrite(BUS_RELAY, value ? LOW : HIGH);

  JsonObject& state = jsonBuffer.createObject();
  state["active"] = value;
  thermPublish(state);
}

void thermProbeValues() {
  Serial.print("Requesting temperatures... ");
  sensors.requestTemperatures(); // Send the command to get temperatures
  Serial.println("done");

  StaticJsonBuffer<200> jsonBuffer;
  JsonObject& root = jsonBuffer.createObject();
  JsonArray& data = root.createNestedArray("values");
  
  float temp1 = sensors.getTempCByIndex(0);
  data.add(temp1);
  Serial.print("Device 1: ");
  Serial.println(temp1); 
  
  float temp2 = sensors.getTempCByIndex(1);
  data.add(temp2);
  Serial.print("Device 2: ");
  Serial.println(temp2);    
  
  thermPublish(root);
  
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


