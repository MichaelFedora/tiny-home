<template>
<div id='tiny-loading'></div>
</template>
<script src='./loading.ts'></script>
<style lang='scss'>
div#tiny-loading {
  position: relative;
  background-color: hsl(0, 0%, 4%);
  width: 10px;
  height: 10px;
  margin: 0 auto;
  border-radius: 50%;

  &:after, &:before {
    content: "";
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  &:after {
    left: -10px;
    top: -5px;
    background-color:  hsl(0, 0%, 71%);
    transform-origin: 15px 10px;
    animation: axis 1s linear infinite;
  }
  &:before {
    left: -25px;
    top: -15px;
    background-color: hsl(204, 71%,  53%);
    transform-origin: 30px 20px;
    animation: axis 2s linear infinite;
  }
}

@keyframes axis {
  0% {
    transform: rotateZ(0deg) translate3d(0,0,0);
  }
  100% {
    transform: rotateZ(360deg) translate3d(0,0,0);
  }
}
</style>
