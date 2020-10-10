/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";

/* Viewing parameters */
var eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var lookAt = new vec3.fromValues(0,0,1); // Default lookAt vector
var upVector = new vec3.fromValues(0,1,0); // Default up vector
var lightLoc = new vec3.fromValues(-0.5,1.5,-0.5); // Default light location
var lightColor = {ambient: 1, diffuse: 1, specular: 1}; // Color of default light
var projectionMatrix = mat4.create(); // projection matrix in JS
var viewMatrix = mat4.create(); // view matrix in JS
var transformMatrix = mat4.create(); // transform matrix in JS
var viewportMatrix = mat4.create(); // viewport matrix in JS

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!

var vertexBuffer; // this contains vertex coordinates in triples
var normalBuffer; // this contains normal vectors for each vertex
var triangleBuffer; // this contains indices into vertexBuffer in triples
var shapeNumBuffer; // what number shape is this?
var ambientBuffer; // ambient rgb values for each vertex
var diffuseBuffer; // diffuse rgb values for each vertex
var specularBuffer; // specular rgb values for each vertex
var specExpBuffer; // specular exponent for each vertex
var triBufferSize = 0; // the number of indices in the triangle buffer
var shapeNum = 0; // which shape are we working with? Tris 0,1, Ellipsoids 2-4

// Attributes
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normals for vertex shader
var vertexAmbientAttrib; // ambient color component
var vertexDiffuseAttrib; // diffuse color component
var vertexSpecularAttrib; // specular color component
var vertexSpecExpAttrib; // specular exponent
var vertexShapeNumAttrib; // shape number

// Uniforms
var eyePosUniform; // position of eye in shaders
var projMatrixUniform; // projection matrix in shaders
var viewMatrixUniform; // view matrix in shaders
var xformMatrixUniform; // transform matrix in shaders
var lightPosUniform; // light position in shaders


// ASSIGNMENT HELPER FUNCTIONS

// Returns dot product of two 3D vectors
function dot( vec1, vec2 ) {
    return vec1[0] * vec2[0] + vec1[1] * vec2[1] + vec1[1] * vec2[1];
}

// Returns normalized copy of input vector
function norm( vec1 ) {
    var magnitude = Math.sqrt( Math.pow( vec1[0], 2 ) + Math.pow( vec1[1], 2 ) + Math.pow( vec1[2], 2 ) );
    return new vec3.fromValues(
        vec1[0] / magnitude,
        vec1[1] / magnitude,
        vec1[2] / magnitude);
}

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// Calculates Blinn-Phong color for a given vertex
// function getBPColor(vertex, normal, ambient, diffuse, specular, specExp) {
//     // Get normal vector, normalize
//     normal = norm( {
//         x: (normal[0]),
//         y: (normal[1]),
//         z: (normal[2])
//     } );

//     // Get half vector
//     var light = norm( {
//         x: lightLoc[0] - vertex[0],
//         y: lightLoc[1] - vertex[1],
//         z: lightLoc[2] - vertex[2]});
//     var V = norm( {
//         x: eye[0] - vertex[0],
//         y: eye[1] - vertex[1],
//         z: eye[2] - vertex[2]});
//     var half = norm( {
//         x: light.x + V.x,
//         y: light.y + V.y,
//         z: light.z + V.z});
    
//     // Calculate RGB color components
//     var color = [];
//     for (var i = 0; i < 3; i++) {
//         color[i] = ambient[i] * lightColor.ambient; // ambient term
//         color[i] += diffuse[i] * lightColor.diffuse * dot( normal, light ); // diffuse term
//         color[i] += specular[i] * lightColor.specular * Math.pow( dot( normal, half ), specExp ); // specular term
        
//         // Clamp color bounds
//         if ( color[i] > 1 ) {
//             color[i] = 1;
//         } 
//         else if ( color[i] < 0 ) {
//             color[i] = 0;
//         }
//     }

//     return color;
// }

function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) {
        for (var set = 0; set < inputTriangles.length; set++) {
            var coordArray = []; // array of xyz coords for vertex
            var normArray = []; // array of xyz normal coords for vertex
            var indexArray = []; // array of indices to make triangles
            var ambientArray = []; // ambient rgb for each vertex
            var diffuseArray = []; // diffuse rgb for each vertex
            var specularArray = []; // specular rgb for each vertex
            var specExpArray = []; // specular exponent for BP shading
            var shapeNumArray = []; // what shape is this?

            // Get verticesfrom JSON
            for (var vertex = 0; vertex < inputTriangles[set].vertices.length; vertex++) {
                var vtxToAdd = inputTriangles[set].vertices[vertex];
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
                normArray.push(0,0,-1);
                ambientArray.push(
                    inputTriangles[set].material.ambient[0],
                    inputTriangles[set].material.ambient[1],
                    inputTriangles[set].material.ambient[2]);
                diffuseArray.push(
                    inputTriangles[set].material.diffuse[0],
                    inputTriangles[set].material.diffuse[1],
                    inputTriangles[set].material.diffuse[2]);
                specularArray.push(
                    inputTriangles[set].material.specular[0],
                    inputTriangles[set].material.specular[1],
                    inputTriangles[set].material.specular[2]);
                specExpArray.push(inputTriangles[set].material.n);
                shapeNumArray.push(shapeNum);
            }

            // Get triangle indices from JSON
            for (var face = 0; face < inputTriangles[set].triangles.length; face++) {
                indexArray.push(
                    inputTriangles[set].triangles[face][0],
                    inputTriangles[set].triangles[face][1],
                    inputTriangles[set].triangles[face][2]
                );
                triBufferSize += 3;
            }

            // Activate buffers
            setupBuffers(coordArray, normArray, indexArray, ambientArray, diffuseArray, specularArray, specExpArray, shapeNumArray);

            shapeNum++; // done with this shape
        }
    }
}

function loadEllipsoids() {
    var inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids");
    var sphereFile = getJSONFile("spheren.json","sphere");

    // console.log(sphereFile);

    if (inputEllipsoids != String.null) {
        for (var ellipsoid = 0; ellipsoid < inputEllipsoids.length; ellipsoid++) {
            var coordArray = []; // array of xyz coords for vertex
            var normArray = []; // array of xyz normal coords for vertex
            var indexArray = []; // array of indices to make triangles
            var ambientArray = []; // ambient rgb for each vertex
            var diffuseArray = []; // diffuse rgb for each vertex
            var specularArray = []; // specular rgb for each vertex
            var specExpArray = []; // specular exponent for BP shading
            var shapeNumArray = []; // what shape is this?

            // Load vertex and color arrays
            for (var vtxCoord = 0; vtxCoord < sphereFile[0].vertices.length; vtxCoord += 3) {
                coordArray.push(
                    sphereFile[0].vertices[vtxCoord], 
                    sphereFile[0].vertices[vtxCoord + 1], 
                    sphereFile[0].vertices[vtxCoord + 2]);
                normArray.push(
                    sphereFile[0].normals[vtxCoord],
                    sphereFile[0].normals[vtxCoord + 1],
                    sphereFile[0].normals[vtxCoord + 2]);
                ambientArray.push(
                    inputEllipsoids[ellipsoid].ambient[0],
                    inputEllipsoids[ellipsoid].ambient[1],
                    inputEllipsoids[ellipsoid].ambient[2]);
                diffuseArray.push(
                    inputEllipsoids[ellipsoid].diffuse[0],
                    inputEllipsoids[ellipsoid].diffuse[1],
                    inputEllipsoids[ellipsoid].diffuse[2]);
                specularArray.push(
                    inputEllipsoids[ellipsoid].specular[0],
                    inputEllipsoids[ellipsoid].specular[1],
                    inputEllipsoids[ellipsoid].specular[2]);
                specExpArray.push(inputEllipsoids[ellipsoid].n);
                shapeNumArray.push(shapeNum);
            }

            for (var index = 0; index < sphereFile[0].triangles.length; index += 3) {
                indexArray.push(
                    sphereFile[0].triangles[index],
                    sphereFile[0].triangles[index + 1],
                    sphereFile[0].triangles[index + 2]
                );
                triBufferSize += 3;
            }

            // Add this ellipsoid to webGL buffers
            setupBuffers(coordArray, normArray, indexArray, ambientArray, diffuseArray, specularArray, specExpArray, shapeNumArray);

            shapeNum++; // done with this shape
        }
    }
}

// Send coord, color, tri arrays to WebGL
function setupBuffers(coordArray, normArray, indexArray, ambientArray, diffuseArray, specularArray, specExpArray, shapeNumArray) {
    // send the vertex coords to webGL
    vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

    // send the vertex normals to webGL
    normalBuffer = gl.createBuffer(); // init empty vertex normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normArray),gl.STATIC_DRAW); // coords to that buffer

    // send the triangle indices to webGL
    triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

    // send color values to webGL
    ambientBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    diffuseBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    specularBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    specExpBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, specExpBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specExpArray), gl.STATIC_DRAW); // colors to that buffer

    // send shape numbers to webGL
    shapeNumBuffer = gl.createBuffer(); // init empty shapeNum buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, shapeNumBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapeNumArray), gl.STATIC_DRAW); // numbers to that buffer
}

// setup the webGL shaders
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec3 ambient;
        attribute vec3 diffuse;
        attribute vec3 specular;
        attribute float specularExponent; 
        attribute float shapeNum;

        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            vColor = vec4(diffuse, 1.0);
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        varying lowp vec4 vColor;

        void main(void) {
            gl_FragColor = vColor;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // Setup attributes
                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); // get pointer to vertex shader input
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                vertexAmbientAttrib = gl.getAttribLocation(shaderProgram, "ambient");
                gl.enableVertexAttribArray(vertexAmbientAttrib);

                vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "diffuse");
                gl.enableVertexAttribArray(vertexDiffuseAttrib);

                vertexSpecularAttrib = gl.getAttribLocation(shaderProgram, "specular");
                gl.enableVertexAttribArray(vertexSpecularAttrib);

                vertexSpecExpAttrib = gl.getAttribLocation(shaderProgram, "specularExponent");
                gl.enableVertexAttribArray(vertexSpecExpAttrib);

                vertexShapeNumAttrib = gl.getAttribLocation(shaderProgram, "shapeNum");
                gl.enableVertexAttribArray(vertexShapeNumAttrib);

                // Setup uniforms
                eyePosUniform = gl.getUniformLocation(shaderProgram, 'eyePos');
                gl.uniform3fv(eyePosUniform, eye);

                projMatrixUniform = gl.getUniformLocation(shaderProgram, 'projMatrix');
                gl.uniformMatrix4fv(projMatrixUniform, gl.FALSE, projectionMatrix);

                viewMatrixUniform = gl.getUniformLocation(shaderProgram, 'viewMatrix');
                gl.uniformMatrix4fv(viewMatrixUniform, gl.FALSE, viewMatrix);

                xformMatrixUniform = gl.getUniformLocation(shaderProgram, 'xformMatrix');
                gl.uniformMatrix4fv(xformMatrixUniform, gl.FALSE, transformMatrix);

                lightPosUniform = gl.getUniformLocation(shaderProgram, 'lightPos');
                gl.uniform3fv(lightPosUniform, lightLoc);

            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    // gl.clearColor(bgColor, 0, 0, 1.0);
    requestAnimationFrame(renderTriangles);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    // gl.uniform1i(altPositionUniform, altPosition); // feed

    // normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate
    gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

    // color buffers: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer); // activate
    gl.vertexAttribPointer(vertexAmbientAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer); // activate
    gl.vertexAttribPointer(vertexDiffuseAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer); // activate
    gl.vertexAttribPointer(vertexSpecularAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specExpBuffer); // activate
    gl.vertexAttribPointer(vertexSpecExpAttrib,1,gl.FLOAT,false,0,0); // feed

    // shapeNum buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, shapeNumBuffer); // activate
    gl.vertexAttribPointer(vertexShapeNumAttrib,1,gl.FLOAT,false,0,0); // feed

    // // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render

    // gl.drawArrays(gl.TRIANGLES,0,triBufferSize); // render
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  loadEllipsoids(); // load the ellipsoids from json
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL

} // end main
