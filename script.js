document.getElementById('imageInput').addEventListener('change', async function(event) {
    const files = event.target.files;
    const imageContainer = document.getElementById('imageContainer');
    imageContainer.innerHTML = '';  // Clear previous images

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            const imageItem = document.createElement('div');
            imageItem.classList.add('image-item');

            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.classList.add('uploadedImage');  // Add a class to target styles
            imageItem.appendChild(imgElement);

            const safetyStatus = await classifyImage(file);
            const resultLabel = document.createElement('div');
            resultLabel.textContent = `Safety: ${safetyStatus}`;
            imageItem.appendChild(resultLabel);

            if (safetyStatus === 'unsafe') {
                imgElement.classList.add('blurred');
            }

            // Optionally, add a button to view blurred images
            const viewButton = document.createElement('button');
            viewButton.textContent = 'View Anyway';
            viewButton.classList.add('hidden');
            imageItem.appendChild(viewButton);

            if (safetyStatus === 'unsafe') {
                viewButton.classList.remove('hidden');
            }

            viewButton.addEventListener('click', function() {
                imgElement.classList.remove('blurred');
                viewButton.classList.add('hidden');
            });

            imageContainer.appendChild(imageItem);
        }
    }
});

document.getElementById('fetchImage').addEventListener('click', async function() {
    const url = document.getElementById('urlInput').value;
    const urlImage = document.getElementById('urlImage');
    const urlResult = document.getElementById('urlResult');
    const viewUrlButton = document.getElementById('viewUrlImage');
    const clearUrlButton = document.getElementById('clearUrl');

    if (url) {
        urlImage.src = url;
        urlResult.textContent = "Fetching and classifying...";
        viewUrlButton.classList.add('hidden');
        clearUrlButton.classList.remove('hidden');

        const fetchTimeout = setTimeout(() => {
            urlResult.textContent = "Unable to fetch image. Try uploading.";
            urlImage.src = "";
            viewUrlButton.classList.add('hidden');
        }, 10000); // 10 seconds timeout

        try {
            await fetchImageAndClassify(url);
            clearTimeout(fetchTimeout);
            urlResult.textContent = "Fetch successful, classifying now...";
            const safetyStatus = await classifyImageFromUrl(url);

            urlResult.textContent = `Safety: ${safetyStatus}`;

            if (safetyStatus === 'unsafe') {
                urlImage.classList.add('blurred');
                viewUrlButton.classList.remove('hidden');
            } else {
                urlImage.classList.remove('blurred');
                viewUrlButton.classList.add('hidden');
            }

            viewUrlButton.addEventListener('click', function() {
                urlImage.classList.remove('blurred');
                viewUrlButton.classList.add('hidden');
            });
        } catch (error) {
            urlResult.textContent = "Unable to fetch image. Try uploading.";
            urlImage.src = "";
            viewUrlButton.classList.add('hidden');
        }
    }
});

document.getElementById('clearUrl').addEventListener('click', function() {
    document.getElementById('urlInput').value = '';
    document.getElementById('urlImage').src = '';
    document.getElementById('urlResult').textContent = '';
    document.getElementById('viewUrlImage').classList.add('hidden');
    document.getElementById('clearUrl').classList.add('hidden');
});

async function fetchImageAndClassify(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = url;
        image.onload = resolve;
        image.onerror = reject;
    });
}

async function classifyImageFromUrl(imageUrl) {
    const modelPath = 'image_safety_model.onnx';
    const session = await ort.InferenceSession.create(modelPath);

    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imageUrl;

        image.onload = async function() {
            const canvas = document.createElement('canvas');
            canvas.width = 224;
            canvas.height = 224;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, 224, 224);
            const imageData = context.getImageData(0, 0, 224, 224);
            const input = preprocessImage(imageData);

            const feeds = {};
            feeds[session.inputNames[0]] = new ort.Tensor('float32', input, [1, 3, 224, 224]);

            const outputData = await session.run(feeds);
            const output = outputData[session.outputNames[0]].data;

            const predictedIdx = argMax(output);
            const indexToCategory = {
                0: 'safe',
                1: 'unsafe'
            };

            resolve(indexToCategory[predictedIdx]);
        };
    });
}

async function classifyImage(imageFile) {
    const modelPath = 'image_safety_model.onnx';
    const session = await ort.InferenceSession.create(modelPath);
    
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);

    return new Promise((resolve) => {
        reader.onload = async function(event) {
            const image = new Image();
            image.src = event.target.result;

            image.onload = async function() {
                const canvas = document.createElement('canvas');
                canvas.width = 224;
                canvas.height = 224;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, 224, 224);
                const imageData = context.getImageData(0, 0, 224, 224);
                const input = preprocessImage(imageData);

                const feeds = {};
                feeds[session.inputNames[0]] = new ort.Tensor('float32', input, [1, 3, 224, 224]);

                const outputData = await session.run(feeds);
                const output = outputData[session.outputNames[0]].data;

                const predictedIdx = argMax(output);
                const indexToCategory = {
                    0: 'safe',
                    1: 'unsafe'
                };

                resolve(indexToCategory[predictedIdx]);
            };
        };
    });
}

function preprocessImage(imageData) {
    const { data, width, height } = imageData;
    const float32Data = new Float32Array(width * height * 3);

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4] / 255;
        const g = data[i * 4 + 1] / 255;
        const b = data[i * 4 + 2] / 255;

        float32Data[i] = (r - 0.485) / 0.229;
        float32Data[i + width * height] = (g - 0.456) / 0.224;
        float32Data[i + width * height * 2] = (b - 0.406) / 0.225;
    }

    return float32Data;
}

function argMax(array) {
    return array.indexOf(Math.max(...array));
}

// Automatically classify the example images
window.onload = async function() {
    const safeExample = document.getElementById('safeExample');
    const unsafeExample = document.getElementById('unsafeExample');
    const viewAnywayButton = document.getElementById('viewAnyway');

    const safeStatus = await classifyImageFromUrl(safeExample.src);
    const unsafeStatus = await classifyImageFromUrl(unsafeExample.src);

    if (safeStatus === 'safe') {
        document.querySelectorAll('.example .label')[0].textContent = 'Safe';
    }

    if (unsafeStatus === 'unsafe') {
        unsafeExample.classList.add('blurred');
        document.querySelectorAll('.example .label')[1].textContent = 'Unsafe';
        viewAnywayButton.classList.remove('hidden');

        viewAnywayButton.addEventListener('click', function() {
            unsafeExample.classList.remove('blurred');
            viewAnywayButton.classList.add('hidden');
        });
    }
};
