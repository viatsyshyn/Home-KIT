#include <FS.h>                   //this needs to be first, or it all crashes and burns...

#include <ESP8266WiFi.h>
#include <ESP8266HTTPUpdateServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <DNSServer.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <Thread.h>
#include <ThreadController.h>
#include <Ticker.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include <Wire.h>
#include <Adafruit_ADS1015.h>
#include <DHT.h>

#define DHTTYPE DHT22

#define BUS_DHT D5
#define BUS_PIR D6

WiFiClient client;
PubSubClient mqtt;

DHT dht(BUS_DHT, DHTTYPE);
Adafruit_ADS1015 ads;     /* Use thi for the 12-bit version */

ThreadController controller = ThreadController();
Thread climateThread = Thread();

//for LED status
Ticker ticker;

char mqtt_id[40] = "microclimate";

//flag for saving data
bool shouldSaveConfig = false;

//callback notifying us of the need to save config
void saveConfigCallback () {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    delay(10); // wait for serial port to connect. Needed for Leonardo only
  }
  Serial.println("Serial intialization done");

  Wire.begin(D1, D2); //sda, scl

  pinMode(BUS_PIR, INPUT);
  pinMode(BUILTIN_LED, OUTPUT);
  ticker.attach(0.5, trigger_led);

  //read configuration from FS json
  Serial.println("mounting FS...");

  if (SPIFFS.begin()) {
    Serial.println("mounted file system");
    if (SPIFFS.exists("/config.json")) {
      //file exists, reading and loading
      Serial.println("reading config file");
      File configFile = SPIFFS.open("/config.json", "r");
      if (configFile) {
        Serial.println("opened config file");
        size_t size = configFile.size();
        // Allocate a buffer to store contents of the file.
        std::unique_ptr<char[]> buf(new char[size]);

        configFile.readBytes(buf.get(), size);
        DynamicJsonBuffer jsonBuffer;
        JsonObject& json = jsonBuffer.parseObject(buf.get());
        json.printTo(Serial);
        if (json.success()) {
          Serial.println("\nparsed json");
          strcpy(mqtt_id, json["mqtt_id"]);
        } else {
          Serial.println("failed to load json config");
        }
      }
    }
  } else {
    Serial.println("failed to mount FS");
  }
  //end read
  Serial.println(mqtt_id);


  WiFiManagerParameter custom_mqtt_id("id", "MQTT ID", mqtt_id, 40);

  //WiFiManager
  //Local intialization. Once its business is done, there is no need to keep it around
  WiFiManager wifiManager;
  //reset settings - for testing
  //wifiManager.resetSettings();

  wifiManager.setSaveConfigCallback(saveConfigCallback);

  //set callback that gets called when connecting to previous WiFi fails, and enters Access Point mode
  wifiManager.setAPCallback(configModeCallback);

  wifiManager.addParameter(&custom_mqtt_id);

  //wifiManager.setTimeout(120);
  
  wifiManager.setMinimumSignalQuality();

  //fetches ssid and pass and tries to connect
  //if it does not connect it starts an access point with the specified name
  //here  "AutoConnectAP"
  //and goes into a blocking loop awaiting configuration
  while (!wifiManager.autoConnect(WiFi.hostname().c_str(), "31121985")) {
    Serial.println("failed to connect and hit timeout");
    //reset and try again, or maybe put it to deep sleep
    long_led();
    long_led();
    delay(1000);
  }

  strcpy(mqtt_id, custom_mqtt_id.getValue());

  // save the custom parameters to FS
  if (shouldSaveConfig) {
    Serial.println("saving config");
    DynamicJsonBuffer jsonBuffer;
    JsonObject& json = jsonBuffer.createObject();
    json["mqtt_id"] = mqtt_id;
    
    File configFile = SPIFFS.open("/config.json", "w");
    if (!configFile) {
      Serial.println("failed to open config file for writing");
    }

    json.prettyPrintTo(Serial);
    json.printTo(configFile);
    configFile.close();
    //end save
    Serial.println();
  }
  
  ticker.detach();

  wifiConnect();

  WiFi.hostname(mqtt_id);

  if (!MDNS.begin(mqtt_id)) {
    Serial.println("Error setting up MDNS responder!");
  }
  Serial.println("mDNS responder started");
  MDNS.addService("http", "tcp", 80);
  

  ArduinoOTA.setHostname(mqtt_id);
  ArduinoOTA.onStart([]() { ticker.attach(.1, trigger_led); });
  ArduinoOTA.onEnd([]() { ticker.detach(); });
  ArduinoOTA.onError([](ota_error_t error) { ESP.restart(); });

  /* setup the OTA server */
  ArduinoOTA.begin();

  mqtt.setClient(client); //set client for mqqt (ethernet)
  mqtt.setCallback(mqttCallback); // set callback for subscripting

  mqttConnect();

  climateThread.onRun(climateProbeValues);
  climateThread.setInterval(60000);

  controller.add(&climateThread);

  dht.begin();

  // The ADC input range (or gain) can be changed via the following
  // functions, but be careful never to exceed VDD +0.3V max, or to
  // exceed the upper and lower limits if you adjust the input range!
  // Setting these values incorrectly may destroy your ADC!
  //                                                                ADS1015  ADS1115
  //                                                                -------  -------
  // ads.setGain(GAIN_TWOTHIRDS);  // 2/3x gain +/- 6.144V  1 bit = 3mV      0.1875mV (default)
     ads.setGain(GAIN_ONE);        // 1x gain   +/- 4.096V  1 bit = 2mV      0.125mV
  // ads.setGain(GAIN_TWO);        // 2x gain   +/- 2.048V  1 bit = 1mV      0.0625mV
  // ads.setGain(GAIN_FOUR);       // 4x gain   +/- 1.024V  1 bit = 0.5mV    0.03125mV
  // ads.setGain(GAIN_EIGHT);      // 8x gain   +/- 0.512V  1 bit = 0.25mV   0.015625mV
  // ads.setGain(GAIN_SIXTEEN);    // 16x gain  +/- 0.256V  1 bit = 0.125mV  0.0078125mV
  
  ads.begin();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnect();
  }
  
  if (!mqtt.connected())
  {
    mqttConnect();
  }

  ArduinoOTA.handle();
  controller.run();
  mqtt.loop();
}

//gets called when WiFiManager enters configuration mode
void configModeCallback (WiFiManager *myWiFiManager) {
  Serial.println("Entered config mode");
  Serial.println(WiFi.softAPIP());
  //if you used auto generated SSID, print it
  Serial.println(myWiFiManager->getConfigPortalSSID());
  //entered config mode, make led toggle faster
  ticker.attach(0.2, trigger_led);
}

void wifiConnect() {
  Serial.print("Connecting to '");
  Serial.print(WiFi.SSID());
  Serial.print("' .");
  
  while(WiFi.status() != WL_CONNECTED) {
    blink_wifi();
    Serial.print(".");
    delay(500);
  }

  Serial.println(" connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void mqttConnect() {
  int n = 1;
  do {
    blink_mqtt();
    Serial.print("Searching MQTT service ");
    n = MDNS.queryService("mqtt", "tcp"); // Send out query for mqtt tcp services
    Serial.print(n);
    Serial.println(" service(s) found");
  } while (n == 0);

  String mqtt_server;
  for (int i = 0; i < n; ++i) {
    // Print details for each service found
    Serial.print(i + 1);
    Serial.print(": ");
    Serial.print(MDNS.hostname(i));
    Serial.print(" (");
    Serial.print(MDNS.IP(i));
    Serial.print(":");
    Serial.print(MDNS.port(i));
    Serial.println(")");

    if (MDNS.hostname(i) == "smarthome") {
      mqtt.setServer(MDNS.IP(i), MDNS.port(i)); // set server for mqqt(raspberry)  
      mqtt_server = MDNS.hostname(i);
    }
  }

  Serial.println();
  delay(1000);
  
  Serial.print("Connecting to MQTT server '");
  Serial.print(mqtt_server);
  Serial.print(".local' as '");
  Serial.print(mqtt_id);
  Serial.print("' ");
  
  do {
    blink_mqtt();
    mqtt.connect(mqtt_id);
    Serial.print(".");
    delay(500);
  } while (!mqtt.connected());
  
  Serial.println(" connected.");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  long_led();
  blink_led();

  Serial.print("Handling callback for ");
  Serial.println(String(topic));
}

void climateProbeValues() {
  long_led();
  long_led();
  long_led();
  
  Serial.print("Requesting climate ... ");
  float h = dht.readHumidity();
  Serial.print(h);
  Serial.print(" ");
  
  float t = dht.readTemperature();
  Serial.print(t);
  Serial.print(" ");
  
  // Compute heat index in Celsius (isFahreheit = false)
  float hic = dht.computeHeatIndex(t, h, false);
  Serial.print(hic);
  Serial.print(" ");

  float adc0, adc1, adc2, adc3;

  adc0 = ads.readADC_SingleEnded(0) / 4095.0;
  adc1 = ads.readADC_SingleEnded(1) / 4095.0;
  adc2 = ads.readADC_SingleEnded(2) / 4095.0;
  
  Serial.print(adc0);
  Serial.print(" ");
  Serial.print(adc1);
  Serial.print(" ");
  Serial.print(adc2);
  Serial.print(" ");

  int pir = digitalRead(BUS_PIR) == HIGH;
  Serial.print(pir);
  Serial.print(" ");

  Serial.println("done");
  
  StaticJsonBuffer<200> jsonBuffer;
  JsonObject& root = jsonBuffer.createObject();
  
  if (!isnan(h)) {
    root["humidity"] = h;
  }
  
  if (!isnan(t)) {
    root["temperature"] = t;
  }
  
  if (!isnan(hic)) {
    root["heat-index"] = hic;
  }
  
  root["gases-level"] = adc0;
  root["sound-level"] = adc1;
  root["light-level"] = adc2;
  root["pir-level"] = pir;
  
  
  char buffer[256];
  root.printTo(buffer, sizeof(buffer));

  char pub_topic[80];
  sprintf(pub_topic,"%s/reported",mqtt_id);
  mqtt.publish(pub_topic, buffer); 
    
  blink_led();
  blink_led();
}

void trigger_led()
{
  //toggle state
  int state = digitalRead(BUILTIN_LED);  // get the current state of GPIO1 pin
  digitalWrite(BUILTIN_LED, !state);     // set pin to the opposite state
}

void blink_led()
{
  digitalWrite(BUILTIN_LED, HIGH);     
  delay(200);
  digitalWrite(BUILTIN_LED, LOW);      
  delay(100);
}

void long_led()
{
  digitalWrite(BUILTIN_LED, HIGH);     
  delay(500);
  digitalWrite(BUILTIN_LED, LOW);      
  delay(100);
}

void blink_wifi()
{
  long_led();
  blink_led();
  blink_led();
}

void blink_mqtt()
{
  long_led();
  blink_led();
  blink_led();
  blink_led();
}

