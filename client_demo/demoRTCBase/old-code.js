    // initActions() {
    //     const { views, mediaStatus } = this;

    //     views['toggleMicButton'].addEventListener('click', async () => {
    //         const micIsOn = mediaStatus.audio;

    //         if(micIsOn) {
    //             this.userStream.getAudioTracks()[0].stop();
    //             this.onTurnOffMicCallback();
    //         } else {
    //             await this.requireMedia();
    //             views.userVideo.srcObject = this.userStream.getAudioTracks()[0];
    //             this.onTurnOnMicCallback();
    //         }

    //         mediaStatus.audio = !mediaStatus.audio;
    //     });

    //     views['toggleCameraButton'].addEventListener('click', async () => {
    //         const cameraIsOn = mediaStatus.video;

    //         if(cameraIsOn) {
    //             this.userStream.getVideoTracks()[0].stop();
    //             this.onTurnOffCameraCallback();
    //         } else {
    //             await this.requireMedia();
    //             views.userVideo.srcObject = this.userStream.getVideoTracks()[0];
    //             this.onTurnOnCameraCallback();
    //         }

    //         mediaStatus.video = !cameraIsOn;
    //     });
    // }

    // async requireMedia() {
    //     try {
    //         this.userStream = await navigator.mediaDevices.getUserMedia({ ...this.mediaStatus });
    //     } catch (error) {
    //         alert('Quyền truy cập media bị từ chối');
    //     }        
    // }
    