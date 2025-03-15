// This is our custom web component, which implements Serial port access
class CustomSerial extends HTMLElement {

    // A utility function for creating a new html element with given id and class
    static newElement(tag, id, clsName) {
        const elem = document.createElement(tag);
        elem.className = clsName;
        elem.id = id;
        return elem;
    }

    // A static function for sanitizing command strings to strip out newlines and carriage returns,
    // then add a single newline at the end.
    static sanitizeString(str) {
      return str.replace(/[\n\r]/g, "") + "\n";
    }

    constructor() {
        // Always call super first in constructor
        super();
        
        // class variables
        this.keepReading = true;
        this.delimiterChar = 0x0A;
        this.tokenBuffer = new Uint8Array();

        // get access to the DOM tree for this element
        const shadow = this.attachShadow({mode: 'open'});
        
        // Apply customMidi external stylesheet to the shadow dom
        const linkElem = document.createElement('link');
        linkElem.setAttribute('rel', 'stylesheet');
        linkElem.setAttribute('href', 'components/SerialComponent/SerialComponent.css');

        // Attach the created elements to the shadow dom
        shadow.appendChild(linkElem);

        // create a top level full width strip to hold the component
        this.mainStrip = CustomSerial.newElement('div', 'customSerialMainStrip', 'custom-serial main-strip');
        shadow.appendChild(this.mainStrip);

        // expand/collapse component
        this.titlePanel = CustomSerial.newElement('div', 'customSerialTitlePanel', 'title-panel-collapsed horizontal-panel');
        this.mainStrip.appendChild(this.titlePanel);

        this.expandCollapseButton = CustomSerial.newElement('button', 'customMidiExpandCollapseButton', 'expand-collapse-button collapsed');
        this.expandCollapseButton.innerHTML = "+";
        this.expandCollapseButton.addEventListener('click', (event) => {
            if (this.mainPanel.style.display === 'none') {
            this.mainPanel.style.display = 'flex';
            this.expandCollapseButton.innerHTML = "-";
            this.expandCollapseButton.classList.remove('collapsed');
            this.expandCollapseButton.classList.add('expanded');
            this.titlePanel.classList.remove('title-panel-collapsed');
            this.titlePanel.classList.add('title-panel-expanded');
            } else {
            this.mainPanel.style.display = 'none';
            this.expandCollapseButton.innerHTML = "+";
            this.expandCollapseButton.classList.remove('expanded');
            this.expandCollapseButton.classList.add('collapsed');
            this.titlePanel.classList.remove('title-panel-expanded');
            this.titlePanel.classList.add('title-panel-collapsed');
            }
        });
        this.titlePanel.appendChild(this.expandCollapseButton);

        this.mainLabel = CustomSerial.newElement('div', 'CustomSerialMainLabel', 'custom-serial-label');
        this.mainLabel.innerHTML = "Click here to connect to the Micro:bit";
        this.titlePanel.appendChild(this.mainLabel);


        // Create a top level panel
        this.mainPanel = CustomSerial.newElement('div', 'customSerialMainPanel', 'custom-serial main-panel horizontal-panel');
        this.mainPanel.style.display = 'none';
        this.mainStrip.appendChild(this.mainPanel);

        // Toggle button to connect/disconnect to attached devices
        this.connectionPanel = CustomSerial.newElement('div', 'customSerialConnectionPanel', 'vertical-panel custom-serial-panel');
        this.mainPanel.appendChild(this.connectionPanel);
        this.connectButton = CustomSerial.newElement('button', 'customSerialConnectButton', 'port-toggle toggled-off');
        this.connectButton.innerHTML = "Connect to Micro:bit";
        this.connectionPanel.appendChild(this.connectButton);
        this.connectButton.addEventListener('click', async () => {
            if (!this.connectedPort) { 
                // look for an attached microbit
                const usbVendorId = 0x0d28; // BBC Micro:bit
                try {
                    this.connectedPort = await navigator.serial.requestPort({ filters: [{ usbVendorId }]});
                    
                    // Connect to port
                    await this.connectedPort.open({ baudRate: 115200 });
                    this.connectButton.innerHTML = "Disconnect";
                    this.connectButton.classList.remove('toggled-off');
                    this.connectButton.classList.add('toggled-on');
                    
                    this.keepReading = true;
                    this.finishedReadingPromise = this.readSerialInput();
                    
                } catch(e) {
                    console.warn(`Couldn't find any microbits: ${e}`);
                };
            } else {
                // disconnect
                try {
                    this.keepReading = false;
                    this.reader.cancel();
                    await this.finishedReadingPromise;
                    this.connectedPort = null;
                    this.connectButton.innerHTML = "Connect";
                    this.connectButton.classList.remove('toggled-on');
                    this.connectButton.classList.add('toggled-off');
                    
                } catch (e) {
                    console.warn(`Error disconnecting from microbit: ${e}`);
                }
            }
        });

        // button and text box for sending arbitrary strings to the attached device
        this.sendPanel = CustomSerial.newElement('div', 'customSerialSendPanel', 'vertical-panel custom-serial-panel');
        this.mainPanel.appendChild(this.sendPanel);
              
        this.sendSerialSubPanel = CustomSerial.newElement('div', 'customSerialSendSubPanel', 'horizontal-panel', 'custom-serial-panel');
        this.sendPanel.appendChild(this.sendSerialSubPanel);

        this.sendSerialButton = CustomSerial.newElement('button', 'customSerialSendButton', 'serial-send-button');
        this.sendSerialButton.innerHTML = "Send";
        this.sendSerialSubPanel.appendChild(this.sendSerialButton);
        
        this.sendSerialTextBox = CustomSerial.newElement('input', 'customSerialSendTextBox', 'serial-send-textbox');
        this.sendSerialTextBox.type = 'text';
        this.sendSerialTextBox.value = 'Hello';
        this.sendSerialSubPanel.appendChild(this.sendSerialTextBox);

        this.sendSerialButton.addEventListener('click', (event) => {            
          this.writeToSerial(CustomSerial.sanitizeString(this.sendSerialTextBox.value));
        });

        // also allow user to send string by hitting Enter or Return in the text box
        this.sendSerialTextBox.addEventListener('change', (event) => {
          this.writeToSerial(CustomSerial.sanitizeString(this.sendSerialTextBox.value));
        });

        // Text area for receiving serial data, and button for forwarding to MIDI
        this.receivePanel = CustomSerial.newElement('div', 'customSerialReceivePanel', 'horizontal-panel custom-serial-panel');
        this.mainPanel.appendChild(this.receivePanel);
        
        this.receiveMIDI = true;
        this.receiveMIDIButton = CustomSerial.newElement('div', 'customSerialReceiveMIDIButton', 'filter-toggle toggled-on');
        this.receiveMIDIButton.innerHTML = "MIDI";
        this.receivePanel.appendChild(this.receiveMIDIButton);
        this.receiveMIDIButton.addEventListener('click', async () => {
            if (!this.receiveMIDI) { 
                this.receiveMIDI = true;
                this.receiveMIDIButton.classList.remove('toggled-off');
                this.receiveMIDIButton.classList.add('toggled-on');
            } else {
                this.receiveMIDI = false;
                this.receiveMIDIButton.classList.remove('toggled-on');
                this.receiveMIDIButton.classList.add('toggled-off');                    
            }
        });

        this.receiveGraphics = true;
        this.receiveGraphicsButton = CustomSerial.newElement('div', 'customSerialReceiveGraphicsButton', 'filter-toggle toggled-on');
        this.receiveGraphicsButton.innerHTML = "Graphics";
        this.receivePanel.appendChild(this.receiveGraphicsButton);
        this.receiveGraphicsButton.addEventListener('click', async () => {
            if (!this.receiveGraphics) { 
                this.receiveGraphics = true;
                this.receiveGraphicsButton.classList.remove('toggled-off');
                this.receiveGraphicsButton.classList.add('toggled-on');
            } else {
                this.receiveGraphics = false;
                this.receiveGraphicsButton.classList.remove('toggled-on');
                this.receiveGraphicsButton.classList.add('toggled-off');                    
            }
        });
        
        this.receiveOther = true;
        this.receiveOtherButton = CustomSerial.newElement('div', 'customSerialReceiveOtherButton', 'filter-toggle toggled-on');
        this.receiveOtherButton.innerHTML = "Other";
        this.receivePanel.appendChild(this.receiveOtherButton);
        this.receiveOtherButton.addEventListener('click', async () => {
            if (!this.receiveOther) { 
                this.receiveOther = true;
                this.receiveOtherButton.classList.remove('toggled-off');
                this.receiveOtherButton.classList.add('toggled-on');
            } else {
                this.receiveOther = false;
                this.receiveOtherButton.classList.remove('toggled-on');
                this.receiveOtherButton.classList.add('toggled-off');                    
            }
        });
        
        this.serialReadoutElement = CustomSerial.newElement('div', 'customSerialReadout', 'custom-serial-readout');
        this.receivePanel.appendChild(this.serialReadoutElement);
    }

    
    // Decode tokens as UTF8 strings and log them to the console
    handleToken = function(arr) {
        const stringValue = new TextDecoder().decode(arr);
        // console.log(stringValue.trim());
        const val = stringValue.trim();
        const matchesMIDI = val.match(/^MIDI/);
        const matchesGraphics = val.match(/^Graphics/);
        const matchesOther = !(matchesMIDI || matchesGraphics);
        
        if ((this.receiveMIDI && matchesMIDI) || (this.receiveGraphics && matchesGraphics) || (this.receiveOther && matchesOther)) {
            if (this.serialReadoutElement) {
                this.serialReadoutElement.innerHTML = val;
            }
        }

        if (this.receiveMIDI && matchesMIDI) {
            // send MIDI messages to the MIDI component
            const midi = document.querySelector('custom-midi');
            if (midi) {
                const noteOnMatch = val.match(/NoteOn (\d+) (\d+) (\d+)/);
                if (noteOnMatch && noteOnMatch.length == 4) {
                    midi.sendNoteOn(parseInt(noteOnMatch[1]), parseInt(noteOnMatch[2]), parseInt(noteOnMatch[3]));
                }
                const noteOffMatch = val.match(/NoteOff (\d+) (\d+) (\d+)/);
                if (noteOffMatch && noteOffMatch.length == 4) {
                    midi.sendNoteOff(parseInt(noteOffMatch[1]), parseInt(noteOffMatch[2]), parseInt(noteOffMatch[3]));
                }
                const controlChangeMatch = val.match(/ControlChange (\d+) (\d+) (\d+)/);
                if (controlChangeMatch && controlChangeMatch.length == 4) {
                    midi.sendControlChange(parseInt(controlChangeMatch[1]), parseInt(controlChangeMatch[2]), parseInt(controlChangeMatch[3]));
                }
            }
        }

        if (this.receiveGraphics && matchesGraphics) {
            // send Graphics messages to the Graphics component
            const graphics = document.querySelector('custom-graphics');
            if (graphics) {
                const pitchMatch = val.match(/Pitch ([-]?\d+)/);
                if (pitchMatch && pitchMatch.length == 2) {
                    graphics.receiveTiltPitch(parseInt(pitchMatch[1]));
                }
                const rollMatch = val.match(/Roll ([-]?\d+)/);
                if (rollMatch && rollMatch.length == 2) {
                    graphics.receiveTiltRoll(parseInt(rollMatch[1]));
                }
            }
        }

    }


    expandTokenBuffer(arr) {
        let expandedBuffer = new Uint8Array(this.tokenBuffer.length + arr.length);
        expandedBuffer.set(this.tokenBuffer);
        expandedBuffer.set(arr, this.tokenBuffer.length);
        this.tokenBuffer = expandedBuffer;
    }
    
  
    serialInputProcessor(arr) {
        if (arr && arr.length) {
            let ind = arr.indexOf(this.delimiterChar);
            if (ind >= 0) {
                if (ind > 0) {
                    let part = arr.slice(0, ind);
                    this.expandTokenBuffer(part);
                }    
                try {
                    this.handleToken(this.tokenBuffer);
                } catch(e) {
                    console.log(`Malformed token ${this.tokenBuffer}: ${e}`);
                }
                this.tokenBuffer = new Uint8Array(); 
                this.serialInputProcessor(arr.subarray(ind+1));
            } else {
                this.expandTokenBuffer(arr);
            }
        }
    }
    
    
    async readSerialInput() {
        while (this.connectedPort && this.connectedPort.readable && this.keepReading) {
            this.reader = this.connectedPort.readable.getReader();
            try {
              while (true) {
                const { value, done } = await this.reader.read();
                if (done) {
                  // reader has been canceled.
                  break;
                }
                this.serialInputProcessor(value);
              }
            } catch (error) {
              console.warn(`Error parsing serial input: ${error}. Disconnecting ...`);
              this.keepReading = false;
              this.connectedPort = null;
              this.connectButton.innerHTML = "Connect";
              this.connectButton.classList.remove('toggled-on');
              this.connectButton.classList.add('toggled-off');
            
            } finally {
              this.reader.releaseLock();
            }
        }
        if (this.connectedPort) {
          await this.connectedPort.close();
        }
    }
    
    
    // write data to the serial port
    async writeToSerial(str) {
        if (this.connectedPort) {
            const arr = new TextEncoder().encode(str);
            const writer = this.connectedPort.writable.getWriter();
            await writer.write(arr);
    
            // Allow the serial port to be closed later.
            writer.releaseLock();
        }
    }

}


customElements.define('custom-serial', CustomSerial);
