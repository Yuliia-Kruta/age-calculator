class CustomGraphics extends HTMLElement {

  // A utility function for creating a new html element with given id and class
  static newElement(tag, id, clsName) {
    const elem = document.createElement(tag);
    elem.className = clsName;
    elem.id = id;
    return elem;
  }

  constructor() {
    // Always call super first in constructor
    super();
    
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    this.running = false;

    this.mouseX = 0;
    this.mouseY = 0;
    this.lastTime = performance.now() / 1000;
    this.frame = 0;
    
    // get access to the DOM tree for this element
    const shadow = this.attachShadow({mode: 'open'});

    // Apply customMidi external stylesheet to the shadow dom
    const styleLinkElem = document.createElement('link');
    styleLinkElem.setAttribute('rel', 'stylesheet');
    styleLinkElem.setAttribute('href', 'components/GraphicsComponent/GraphicsComponent.css');

    // we also want prism.css stylesheet for syntax highlighting shader code
    const prismStyleLinkElem = document.createElement('link');
    prismStyleLinkElem.setAttribute('rel', 'stylesheet');
    prismStyleLinkElem.setAttribute('href', 'components/GraphicsComponent/lib/prism.css'); 

    // Attach the created elements to the shadow dom
    shadow.appendChild(styleLinkElem);
    shadow.appendChild(prismStyleLinkElem);

    // load opengl matrix library
    const glScriptElem = document.createElement('script');
    glScriptElem.setAttribute('src', 'components/GraphicsComponent/lib/gl-matrix.js');
    shadow.appendChild(glScriptElem);

    // and load prism syntax highlighting library
    const prismScriptElem = document.createElement('script');
    prismScriptElem.setAttribute('src', 'components/GraphicsComponent/lib/prism.js');
    shadow.appendChild(prismScriptElem);

    // create a top level full width strip to hold the component
    this.mainStrip = CustomGraphics.newElement('div', 'customGraphicsMainStrip', 'custom-graphics main-strip vertical-panel');
    shadow.appendChild(this.mainStrip);

    // expand/collapse component
    this.titlePanel = CustomGraphics.newElement('div', 'customGraphicsTitlePanel', 'title-panel-collapsed horizontal-panel');
    this.mainStrip.appendChild(this.titlePanel);

    this.expandCollapseButton = CustomGraphics.newElement('button', 'customGraphicsExpandCollapseButton', 'expand-collapse-button collapsed');
    this.expandCollapseButton.innerHTML = "+";
    this.expandCollapseButton.addEventListener('click', (event) => {
      if (this.mainPanel.style.visibility !== 'visible') {
        this.mainPanel.style.visibility = 'visible';
        this.expandCollapseButton.innerHTML = "-";
        this.expandCollapseButton.classList.remove('collapsed');
        this.expandCollapseButton.classList.add('expanded');
        this.titlePanel.classList.remove('title-panel-collapsed');
        this.titlePanel.classList.add('title-panel-expanded');
      } else {
        this.mainPanel.style.visibility = 'collapse';
        this.expandCollapseButton.innerHTML = "+";
        this.expandCollapseButton.classList.remove('expanded');
        this.expandCollapseButton.classList.add('collapsed');
        this.titlePanel.classList.remove('title-panel-expanded');
        this.titlePanel.classList.add('title-panel-collapsed');
      }
    });
    this.titlePanel.appendChild(this.expandCollapseButton);

    this.mainLabel = CustomGraphics.newElement('div', 'CustomGraphicsMainLabel', 'custom-graphics-label');
    this.mainLabel.innerHTML = "Graphics";
    this.titlePanel.appendChild(this.mainLabel);

    // Create a top level panel, that need not be full width
    this.mainPanel = CustomGraphics.newElement('div', 'customGraphicsMainPanel', 'custom-graphics main-panel vertical-panel');
    this.mainPanel.style.visibility = 'collapse';
    this.mainStrip.appendChild(this.mainPanel);

    this.canvas = CustomGraphics.newElement('canvas', 'customGraphicsCanvas', 'custom-graphics-canvas');
    this.canvas.width = "1200";
    this.canvas.height = "800";
    this.mainPanel.appendChild(this.canvas);
    this.canvas.addEventListener('mousemove', this.setMousePosition.bind(this));
    this.gl = this.canvas.getContext('webgl2');

    // this.controlPanel = CustomGraphics.newElement('div', 'customGraphicsControlPanel', 'vertical custom-graphics-panel');
    // this.mainPanel.appendChild(this.controlPanel);
    this.canvasControls = CustomGraphics.newElement('div', 'customGraphicsControls', 'custom-graphics-panel horizontal-panel');
    this.mainPanel.appendChild(this.canvasControls);

    this.canvasPlayButton = CustomGraphics.newElement('button', 'customGraphicsCanvasRun', 'play-button toggled-off');
    this.canvasControls.appendChild(this.canvasPlayButton);
    this.canvasPlayButton.innerHTML = "Play";
    this.canvasPlayButton.addEventListener('click', (event) => {
      if (!this.running) { 
        this.running = true;
        requestAnimationFrame(this.render.bind(this));

        this.canvasPlayButton.innerHTML = "Pause";
        this.canvasPlayButton.classList.remove('toggled-off');
        this.canvasPlayButton.classList.add('toggled-on');
         
      } else {
        this.running = false;

        this.canvasPlayButton.innerHTML = "Play";
        this.canvasPlayButton.classList.remove('toggled-on');
        this.canvasPlayButton.classList.add('toggled-off');
      }
    });

    this.copyCodeButton = CustomGraphics.newElement('button', 'customGraphicsCopyButton', 'copy-button');
    this.copyCodeButton.innerHTML = "Copy from Clipboard";
    this.canvasControls.appendChild(this.copyCodeButton);
    this.copyCodeButton.addEventListener('click', async (event) => {
      const strCode = await navigator.clipboard.readText();
      // check that this looks like valid shaderToy code, with a mainImage function
      if (!strCode.match(/void\s+mainImage/)) {
        alert("The clipboard doesn't appear to have a valid shadertoy program in it");
        return;
      }
      this.setShaderToySource(strCode);
    });

    this.showCodeButton = CustomGraphics.newElement('button', 'customGraphicsShowCodeButton', 'show-button toggled-off');
    this.showCodeButton.innerHTML = "Show code";
    this.canvasControls.appendChild(this.showCodeButton);

    // Prism syntax highlighting prefers code to be in a <pre><code> ... </code></pre> context
    this.shaderToyCodePre = CustomGraphics.newElement('pre', 'customGraphicsCodePre', 'custom-graphics-code-pre language-glsl');
    this.mainPanel.appendChild(this.shaderToyCodePre);

    this.shaderToyCode = CustomGraphics.newElement('code', 'customGraphicsCode', 'custom-graphics-code language-glsl');
    this.shaderToyCodePre.appendChild(this.shaderToyCode);

    // hide code by default
    this.shaderToyCodePre.style.visibility = 'collapse';
    
    // show hide the code with the showCodeButton
    this.showCodeButton.addEventListener('click', (event) => {
      if (this.shaderToyCodePre.style.visibility !== 'visible') {
        this.shaderToyCodePre.style.visibility = 'visible';
        this.showCodeButton.innerHTML = "Hide code";
        this.showCodeButton.classList.remove('toggled-off');
        this.showCodeButton.classList.add('toggled-on');
      } else {
        this.shaderToyCodePre.style.visibility = 'collapse';
        this.showCodeButton.innerHTML = "Show code";
        this.showCodeButton.classList.remove('toggled-on');
        this.showCodeButton.classList.add('toggled-off');
      }
    });

    // setup opengl stuff
    this.buffers = this.initCanvasBuffers(this.gl);

    // setup default shaders
    // Vertex shader program for spectrogram. This does nothing but pass directly through
    // All the interesting stuff happens in the fragment shader
    this.vsSource = `# version 300 es
    in vec4 aVertexPosition;
    in vec2 aTextureCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    out highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
    `;

    // Fragment shader program for spectrogram
    this.fsPrefix = `# version 300 es
    precision highp float;
    in highp vec2 vTextureCoord;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform float iTimeDelta;
    uniform int iFrame;
    uniform float iFrameRate;
    uniform vec4 iDate;
    uniform vec4 iMouse;
  
    `

    let shaderToySource = `
    // Protean clouds by nimitz (twitter: @stormoid)
    // https://www.shadertoy.com/view/3l23Rh
    // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
    // Contact the author for other licensing options

    /*
      Technical details:

      The main volume noise is generated from a deformed periodic grid, which can produce
      a large range of noise-like patterns at very cheap evalutation cost. Allowing for multiple
      fetches of volume gradient computation for improved lighting.

      To further accelerate marching, since the volume is smooth, more than half the density
      information isn't used to rendering or shading but only as an underlying volume	distance to 
      determine dynamic step size, by carefully selecting an equation	(polynomial for speed) to 
      step as a function of overall density (not necessarialy rendered) the visual results can be 
      the	same as a naive implementation with ~40% increase in rendering performance.

      Since the dynamic marching step size is even less uniform due to steps not being rendered at all
      the fog is evaluated as the difference of the fog integral at each rendered step.

    */

    mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
    const mat3 m3 = mat3(0.33338, 0.56034, -0.71817, -0.87887, 0.32651, -0.15323, 0.15162, 0.69596, 0.61339)*1.93;
    float mag2(vec2 p){return dot(p,p);}
    float linstep(in float mn, in float mx, in float x){ return clamp((x - mn)/(mx - mn), 0., 1.); }
    float prm1 = 0.;
    vec2 bsMo = vec2(0);

    vec2 disp(float t){ return vec2(sin(t*0.22)*1., cos(t*0.175)*1.)*2.; }

    vec2 map(vec3 p)
    {
        vec3 p2 = p;
        p2.xy -= disp(p.z).xy;
        p.xy *= rot(sin(p.z+iTime)*(0.1 + prm1*0.05) + iTime*0.09);
        float cl = mag2(p2.xy);
        float d = 0.;
        p *= .61;
        float z = 1.;
        float trk = 1.;
        float dspAmp = 0.1 + prm1*0.2;
        for(int i = 0; i < 5; i++)
        {
        p += sin(p.zxy*0.75*trk + iTime*trk*.8)*dspAmp;
            d -= abs(dot(cos(p), sin(p.yzx))*z);
            z *= 0.57;
            trk *= 1.4;
            p = p*m3;
        }
        d = abs(d + prm1*3.)+ prm1*.3 - 2.5 + bsMo.y;
        return vec2(d + cl*.2 + 0.25, cl);
    }

    vec4 render( in vec3 ro, in vec3 rd, float time )
    {
      vec4 rez = vec4(0);
        const float ldst = 8.;
      vec3 lpos = vec3(disp(time + ldst)*0.5, time + ldst);
      float t = 1.5;
      float fogT = 0.;
      for(int i=0; i<130; i++)
      {
        if(rez.a > 0.99)break;

        vec3 pos = ro + t*rd;
            vec2 mpv = map(pos);
        float den = clamp(mpv.x-0.3,0.,1.)*1.12;
        float dn = clamp((mpv.x + 2.),0.,3.);
            
        vec4 col = vec4(0);
            if (mpv.x > 0.6)
            {
            
                col = vec4(sin(vec3(5.,0.4,0.2) + mpv.y*0.1 +sin(pos.z*0.4)*0.5 + 1.8)*0.5 + 0.5,0.08);
                col *= den*den*den;
          col.rgb *= linstep(4.,-2.5, mpv.x)*2.3;
                float dif =  clamp((den - map(pos+.8).x)/9., 0.001, 1. );
                dif += clamp((den - map(pos+.35).x)/2.5, 0.001, 1. );
                col.xyz *= den*(vec3(0.005,.045,.075) + 1.5*vec3(0.033,0.07,0.03)*dif);
            }
        
        float fogC = exp(t*0.2 - 2.2);
        col.rgba += vec4(0.06,0.11,0.11, 0.1)*clamp(fogC-fogT, 0., 1.);
        fogT = fogC;
        rez = rez + col*(1. - rez.a);
        t += clamp(0.5 - dn*dn*.05, 0.09, 0.3);
      }
      return clamp(rez, 0.0, 1.0);
    }

    float getsat(vec3 c)
    {
        float mi = min(min(c.x, c.y), c.z);
        float ma = max(max(c.x, c.y), c.z);
        return (ma - mi)/(ma+ 1e-7);
    }

    //from my "Will it blend" shader (https://www.shadertoy.com/view/lsdGzN)
    vec3 iLerp(in vec3 a, in vec3 b, in float x)
    {
        vec3 ic = mix(a, b, x) + vec3(1e-6,0.,0.);
        float sd = abs(getsat(ic) - mix(getsat(a), getsat(b), x));
        vec3 dir = normalize(vec3(2.*ic.x - ic.y - ic.z, 2.*ic.y - ic.x - ic.z, 2.*ic.z - ic.y - ic.x));
        float lgt = dot(vec3(1.0), ic);
        float ff = dot(dir, normalize(ic));
        ic += 1.5*dir*sd*ff*lgt;
        return clamp(ic,0.,1.);
    }

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {	
      vec2 q = fragCoord.xy/iResolution.xy;
        vec2 p = (gl_FragCoord.xy - 0.5*iResolution.xy)/iResolution.y;
        bsMo = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
        
        float time = iTime*3.;
        vec3 ro = vec3(0,0,time);
        
        ro += vec3(sin(iTime)*0.5,sin(iTime*1.)*0.,0);
            
        float dspAmp = .85;
        ro.xy += disp(ro.z)*dspAmp;
        float tgtDst = 3.5;
        
        vec3 target = normalize(ro - vec3(disp(time + tgtDst)*dspAmp, time + tgtDst));
        ro.x -= bsMo.x*2.;
        vec3 rightdir = normalize(cross(target, vec3(0,1,0)));
        vec3 updir = normalize(cross(rightdir, target));
        rightdir = normalize(cross(updir, target));
      vec3 rd=normalize((p.x*rightdir + p.y*updir)*1. - target);
        rd.xy *= rot(-disp(time + 3.5).x*0.2 + bsMo.x);
        prm1 = smoothstep(-0.4, 0.4,sin(iTime*0.3));
      vec4 scn = render(ro, rd, time);
        
        vec3 col = scn.rgb;
        col = iLerp(col.bgr, col.rgb, clamp(1.-prm1,0.05,1.));
        
        col = pow(col, vec3(.55,0.65,0.6))*vec3(1.,.97,.9);

        col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.12)*0.7+0.3; //Vign
        
      fragColor = vec4( col, 1.0 );
    }    

    `;
    
    this.fsPostfix = `
    
    out vec4 fragColor;
    void main() {
      mainImage(fragColor, gl_FragCoord.xy);
    }
    `;

    this.setShaderToySource(shaderToySource);

  }
  
  // mouse tracking in the graphics canvas
  setMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = rect.height - (e.clientY - rect.top) - 1;  // bottom is 0 in WebGL
    // console.log(`Mouse: ${this.mouseX} ${this.mouseY}`);
  }

  // convert tilt values into mouseX mouseY
  receiveTiltPitch(val) {
    // Pitch values go from -180 to 180, with 0 being flat upright (these are degrees)
    // Map pitch to the mouseY with 0 degrees being in the centre
    const rect = this.canvas.getBoundingClientRect();
    const halfwayUp = rect.bottom - rect.height / 2; // DOMRects are upside down
    const r = Math.max(Math.min(val, 90), -90) / 90;
    this.mouseY = halfwayUp - r * rect.height / 2;
  } 

  // convert tilt values into mouseX mouseY
  receiveTiltRoll(val) {
    // Roll values go from -180 to 180, with 0 being flat upright (these are degrees)
    // Map roll to the mouseX with 0 degrees being in the centre
    const rect = this.canvas.getBoundingClientRect();
    const halfwayAcross = rect.left + rect.width / 2;
    const r = Math.max(Math.min(val, 90), -90) / 90;
    this.mouseX = halfwayAcross + r * rect.width / 2;
  } 
  
  // Combines the copy/pasted code from shaderToy into our proper fragment shader
  combineFragmentShaderSources() {
    this.fsSource = this.fsPrefix + this.shaderToySource + this.fsPostfix;
  }
  
  // sets the shadertoy source in our fragment shader program, and also in the code display
  setShaderToySource(srcString) {
    this.shaderToySource = srcString;
    this.shaderToyCode.innerHTML = srcString.replace(/&/g, "&amp").replace(/</g, "&lt").replace(/>/g, "&gt");
    this.combineFragmentShaderSources();
    this.shaderProgram = this.initShaderProgram(this.gl, this.vsSource, this.fsSource);
    
    this.programInfo = {
      program: this.shaderProgram,
      attribLocations: {
        vertexPosition: this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition'),
        textureCoord: this.gl.getAttribLocation(this.shaderProgram, 'aTextureCoord'),
      },
      uniformLocations: {
        projectionMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
        resolution: this.gl.getUniformLocation(this.shaderProgram, "iResolution"),
        time: this.gl.getUniformLocation(this.shaderProgram, "iTime"),
        timeDelta: this.gl.getUniformLocation(this.shaderProgram, "iTimeDelta"),
        frame: this.gl.getUniformLocation(this.shaderProgram, "iFrame"),
        frameDelta: this.gl.getUniformLocation(this.shaderProgram, "iFrameDelta"),
        mouse: this.gl.getUniformLocation(this.shaderProgram, "iMouse"),
        date: this.gl.getUniformLocation(this.shaderProgram, "iDate"),        
      },
    }; 
  }

  initCanvasBuffers(gl) {

    // Create a buffer for the square's positions.
    const positionBuffer = gl.createBuffer();
  
    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  
    // Now create an array of positions for the square.
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
       1.0,  1.0,
      -1.0,  1.0,
    ];
  
    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
    // Create the texture coordinates
    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  
    const textureCoordinates = [
      // Front
      0.0,  1.0,
      1.0,  1.0,
      1.0,  0.0,
      0.0,  0.0,
    ];
  
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
  
    // Build the element array buffer; this specifies the indices
    // into the vertex arrays for each face's vertices.
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  
    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.
    const indices = [
      0,  1,  2,      0,  2,  3,
    ];
  
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  
    return {
      position: positionBuffer,
      textureCoord: textureCoordBuffer,
      indices: indexBuffer,
    };
  }
  

  initTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);
  
    // Turn off mips and set  wrapping to clamp to edge so it
    // will work regardless of the dimensions of the video.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  
    return texture;
  }
  

  updateTextureFromImage(gl, texture, image) {
    const level = 0;
    const internalFormat = gl.RGBA;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    //gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);
  }
  
  
  zeroTexture(gl, texture) {
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const blackPixel = new Uint8Array([0, 0, 0, 0]);  // transparent black
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  blackPixel);
  }
  

  // Main drawing routine for the video display
  render( time ) {
    const gl = this.gl;
    time *= 0.001
    const timeDelta = time - this.lastTime;
    this.lastTime = time;
    this.frame++;
    const frameRate = 1 / timeDelta;
    const today = new Date();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const projectionMatrix = mat4.create();

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    const modelViewMatrix = mat4.create();

    // Now move the drawing position a bit to where we want to
    // start drawing the square.
    // mat4.translate(modelViewMatrix,     // destination matrix
    //                modelViewMatrix,     // matrix to translate
    //                [poi.x, poi.y, -0.0]);

    // mat4.scale(modelViewMatrix,
    //            modelViewMatrix,
    //             [zoom, zoom, 1.0]);

    // mat4.translate(modelViewMatrix,     // destination matrix
    //                modelViewMatrix,     // matrix to translate
    //                [-1 * poi.x, -1 * poi.y, -0.0]);  // amount to translate


    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
      gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset);
      gl.enableVertexAttribArray(
      this.programInfo.attribLocations.vertexPosition);
    }

    // Tell WebGL how to pull out the texture coordinates from
    // the texture coordinate buffer into the textureCoord attribute.
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.textureCoord);
      gl.vertexAttribPointer(
      this.programInfo.attribLocations.textureCoord,
      numComponents,
      type,
      normalize,
      stride,
      offset);
      gl.enableVertexAttribArray(
      this.programInfo.attribLocations.textureCoord);
    }

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);

    // Tell WebGL to use our program when drawing
    gl.useProgram(this.programInfo.program);

    // Set the shader uniforms
    gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);

    gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);

    // Specify the texture to map onto the canvas.
    // We will store the experience image in texture unit 0
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, experienceTexture);
    // gl.uniform1i(programInfo.uniformLocations.experienceImage, 0);

    // and the countdown in texture unit 1
    // gl.activeTexture(gl.TEXTURE0 + 1);
    // gl.bindTexture(gl.TEXTURE_2D, countdownTexture);
    
    gl.uniform3f(this.programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height, 1);
    gl.uniform1f(this.programInfo.uniformLocations.time, time);
    gl.uniform1f(this.programInfo.uniformLocations.timeDelta, timeDelta);
    gl.uniform1i(this.programInfo.uniformLocations.frame, this.frame);
    gl.uniform1f(this.programInfo.uniformLocations.frame, frameRate);
    gl.uniform4f(this.programInfo.uniformLocations.mouse, this.mouseX, this.mouseY, this.mouseX, this.mouseY);
    gl.uniform4f(this.programInfo.uniformLocations.date, today.getFullYear(), today.getMonth(), today.getDay(), today.getSeconds());

    { // process the textures into the quad
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      const vertexCount = 6;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }

    if (this.running) { 
      requestAnimationFrame(this.render.bind(this));
    }

  }

  
  loadShader(gl, type, source) {
    const shader = gl.createShader(type);
  
    // Send the source to the shader object
    gl.shaderSource(shader, source);
  
    // Compile the shader program
    gl.compileShader(shader);
  
    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
  
    return shader;
  }
  
  
  initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  
    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }
  
    return shaderProgram;
  }

}


customElements.define('custom-graphics', CustomGraphics);
